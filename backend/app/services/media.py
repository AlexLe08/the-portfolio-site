"""Image uploads for the media library: checks, Cloudinary, and the row.

Files travel browser -> Next.js Server Action -> POST /media -> Cloudinary
(see docs/roadmap.md for why not a direct browser upload). The router turns
the exceptions below into HTTP status codes; nothing here knows about HTTP.
"""

import logging
import re
import unicodedata
import uuid
from urllib.parse import urlparse

import cloudinary.exceptions
import cloudinary.uploader
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.core.config import settings

# Vercel rejects function request bodies over 4.5 MB, and every upload
# passes through a Server Action there first. 4 MB leaves room for the
# multipart overhead and the alt text.
MAX_UPLOAD_BYTES = 4 * 1024 * 1024

# What a browser may declare, and what Cloudinary's "format" must come back
# as. SVG is left out on purpose: it can carry scripts.
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
}
_CONTENT_TYPE_BY_FORMAT = {fmt: ctype for ctype, fmt in ALLOWED_CONTENT_TYPES.items()}

# The account uses Cloudinary's dynamic folder mode, where a slash in the
# public_id is only part of the name: asset_folder is what puts the file in
# a folder in the Console. Neither changes the other.
FOLDER = "portfolio"

# public_ids read as "portfolio/<alt-text-slug>-<random>". The slug is for
# people (Console, URLs); the random suffix is what keeps names unique.
SLUG_MAX_LENGTH = 60
SUFFIX_LENGTH = 12

logger = logging.getLogger(__name__)


class UploadsDisabled(Exception):
    """CLOUDINARY_URL isn't set."""


class FileTooLarge(Exception):
    pass


class UnsupportedImage(Exception):
    """Not one of ALLOWED_CONTENT_TYPES, or Cloudinary couldn't read it."""


class ProviderError(Exception):
    """Cloudinary failed for a reason that isn't the file's fault."""


class InUse(Exception):
    """Site text still embeds the image, so deleting it would break a page."""

    def __init__(self, usages: list[str]):
        super().__init__(usages)
        self.usages = usages


def _credentials() -> dict[str, str]:
    # Passed on every call rather than through cloudinary.config(), which is
    # global SDK state: config() also doesn't parse a cloudinary:// URL, and
    # the SDK reading CLOUDINARY_URL from os.environ itself would bypass
    # Settings. The URL's shape was already checked when Settings loaded.
    url = settings.cloudinary_url.get_secret_value()
    if not url:
        raise UploadsDisabled()
    parsed = urlparse(url)
    return {
        "cloud_name": parsed.hostname,
        "api_key": parsed.username,
        "api_secret": parsed.password,
    }


def upload_image(db: Session, *, data: bytes, content_type: str, alt_text: str) -> models.Media:
    credentials = _credentials()
    if len(data) > MAX_UPLOAD_BYTES:
        raise FileTooLarge()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UnsupportedImage()

    # data must stay bytes: the SDK treats a str as a file path or a URL to fetch.
    try:
        result = cloudinary.uploader.upload(
            data,
            public_id=_public_id(alt_text),
            asset_folder=FOLDER,
            resource_type="image",
            overwrite=False,
            timeout=30,
            **credentials,
        )
    except cloudinary.exceptions.BadRequest as error:
        # e.g. "Invalid image file": the bytes didn't match the declared type.
        raise UnsupportedImage() from error
    except cloudinary.exceptions.Error as error:
        raise ProviderError() from error

    # With overwrite=False, a public_id that's already taken gets the
    # existing file back instead of a new upload. It belongs to another row,
    # so fail without the cleanup below, which would delete it.
    if result.get("existing"):
        raise ProviderError()

    # The declared content type came from the browser; Cloudinary's format
    # is what the file actually is.
    actual_type = _CONTENT_TYPE_BY_FORMAT.get(result["format"])
    if actual_type is None:
        _delete_quietly(result["public_id"], credentials)
        raise UnsupportedImage()

    media = models.Media(
        url=result["secure_url"],
        public_id=result["public_id"],
        alt_text=alt_text,
        width=result["width"],
        height=result["height"],
        content_type=actual_type,
        size_bytes=result["bytes"],
    )
    db.add(media)
    try:
        db.commit()
    except Exception:
        # Without the row, nothing points at the file, so don't keep it.
        db.rollback()
        _delete_quietly(result["public_id"], credentials)
        raise
    db.refresh(media)
    return media


def _public_id(alt_text: str) -> str:
    # "Café diagram (v2)!" -> "cafe-diagram-v2": accents folded to ASCII,
    # anything else that isn't a letter or digit becomes a single hyphen.
    ascii_text = unicodedata.normalize("NFKD", alt_text).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    slug = slug[:SLUG_MAX_LENGTH].rstrip("-") or "image"
    return f"{FOLDER}/{slug}-{uuid.uuid4().hex[:SUFFIX_LENGTH]}"


def find_media(db: Session, media_id: int) -> models.Media | None:
    return db.get(models.Media, media_id)


def list_media(db: Session) -> list[models.Media]:
    # Newest first; id breaks ties between uploads in the same second.
    stmt = select(models.Media).order_by(models.Media.created_at.desc(), models.Media.id.desc())
    return list(db.scalars(stmt))


def find_usages(db: Session, media: models.Media) -> list[str]:
    """Where site text embeds the image, e.g. ["project my-app", "content home.intro"].

    Images are only ever pasted in as markdown, so this is a text search.
    It looks for the public_id rather than the stored URL: the random suffix
    makes it just as unique, and it also matches resized Cloudinary URLs
    (".../upload/w_400/portfolio/..."). Drafts count, since publishing one
    would show the broken image.
    """
    # autoescape: "%" and "_" in the search text are literal, not LIKE wildcards.
    projects = db.scalars(
        select(models.Project.slug)
        .where(
            models.Project.summary.contains(media.public_id, autoescape=True)
            | models.Project.case_study_md.contains(media.public_id, autoescape=True)
        )
        .order_by(models.Project.slug)
    )
    content = db.scalars(
        select(models.SiteContent.key)
        .where(models.SiteContent.value.contains(media.public_id, autoescape=True))
        .order_by(models.SiteContent.key)
    )
    return [f"project {slug}" for slug in projects] + [f"content {key}" for key in content]


def delete_media(db: Session, media: models.Media) -> None:
    # The Cloudinary file goes first. If that fails, the row stays and the
    # delete can be retried; the other order would leave an orphan file that
    # nothing points at. A file that's already gone counts as deleted, so a
    # retry after a failed commit below still finishes.
    usages = find_usages(db, media)
    if usages:
        raise InUse(usages)
    credentials = _credentials()
    try:
        result = cloudinary.uploader.destroy(
            media.public_id, resource_type="image", invalidate=True, timeout=30, **credentials
        )
    except cloudinary.exceptions.NotFound:
        # Cloudinary's docs don't say whether a missing file is this
        # exception or a {"result": "not found"} body, so both are handled.
        result = {"result": "not found"}
    except cloudinary.exceptions.Error as error:
        raise ProviderError() from error
    if result.get("result") not in ("ok", "not found"):
        raise ProviderError()

    db.delete(media)
    db.commit()


def _delete_quietly(public_id: str, credentials: dict[str, str]) -> None:
    # Cleanup after another failure: that failure is the one to report, so
    # a failed delete is only logged, naming the orphan file to remove in
    # the Cloudinary console.
    try:
        cloudinary.uploader.destroy(public_id, resource_type="image", invalidate=True, **credentials)
    except cloudinary.exceptions.Error as error:
        logger.warning("Could not delete orphan Cloudinary file %s: %s", public_id, type(error).__name__)
