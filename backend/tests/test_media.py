import re

import cloudinary.exceptions
import pytest
from pydantic import SecretStr, ValidationError
from sqlalchemy.exc import IntegrityError

from app.core.config import Settings, settings
from app.models import Media, SiteContent
from app.services import media as media_service
from tests.helpers import ADMIN_HEADERS, make_project

SECRET = "not-a-real-secret-abc123"


def make_media(public_id: str) -> Media:
    return Media(
        url=f"https://res.cloudinary.com/demo-cloud/image/upload/{public_id}.webp",
        public_id=public_id,
        alt_text="A diagram",
        width=1200,
        height=800,
        content_type="image/webp",
        size_bytes=48_000,
    )


def test_media_row_gets_an_id_and_created_at(db_session):
    media = make_media("portfolio/diagram")
    db_session.add(media)
    db_session.commit()

    assert media.id is not None
    assert media.created_at is not None


def test_public_id_is_unique(db_session):
    db_session.add(make_media("portfolio/diagram"))
    db_session.commit()

    db_session.add(make_media("portfolio/diagram"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_cloudinary_url_accepts_the_console_format():
    url = f"cloudinary://123456789012345:{SECRET}@demo-cloud"

    assert Settings(cloudinary_url=url).cloudinary_url.get_secret_value() == url


def test_cloudinary_url_may_be_empty():
    assert Settings(cloudinary_url="").cloudinary_url.get_secret_value() == ""


@pytest.mark.parametrize(
    "url",
    [
        # The name pasted twice: the Console's copy button includes it.
        f"CLOUDINARY_URL=cloudinary://123456789012345:{SECRET}@demo-cloud",
        f"https://123456789012345:{SECRET}@demo-cloud",
        f"cloudinary://123456789012345:{SECRET}@",
        "cloudinary://<api_key>:<api_secret>@demo-cloud ",
    ],
)
def test_malformed_cloudinary_url_fails_at_startup(url):
    with pytest.raises(ValidationError, match="must look like cloudinary://") as error:
        Settings(cloudinary_url=url)

    # Startup errors land in Render's logs, so the secret must not be in them.
    assert SECRET not in str(error.value)


# --- POST /media and GET /admin/media, with Cloudinary replaced by a fake ---

PNG = b"\x89PNG\r\n\x1a\n fake image bytes"


class FakeCloudinary:
    """Stands in for cloudinary.uploader: records calls, never touches the network."""

    def __init__(self):
        self.uploads = []
        self.destroyed = []
        self.format = "png"
        self.upload_error = None
        self.existing = False
        self.destroy_result = "ok"
        self.destroy_error = None

    def upload(self, file, **options):
        self.uploads.append((file, options))
        if self.upload_error:
            raise self.upload_error
        return {
            "existing": self.existing,
            "public_id": options["public_id"],
            "secure_url": f"https://res.cloudinary.com/demo-cloud/image/upload/v1/{options['public_id']}.{self.format}",
            "width": 1200,
            "height": 800,
            "format": self.format,
            "bytes": len(file),
            "resource_type": "image",
        }

    def destroy(self, public_id, **options):
        self.destroyed.append(public_id)
        if self.destroy_error:
            raise self.destroy_error
        return {"result": self.destroy_result}


@pytest.fixture()
def fake_cloudinary(monkeypatch):
    fake = FakeCloudinary()
    monkeypatch.setattr("cloudinary.uploader.upload", fake.upload)
    monkeypatch.setattr("cloudinary.uploader.destroy", fake.destroy)
    monkeypatch.setattr(
        settings, "cloudinary_url", SecretStr(f"cloudinary://123456789012345:{SECRET}@demo-cloud")
    )
    return fake


def post_image(client, *, data=PNG, content_type="image/png", alt_text="A diagram", headers=ADMIN_HEADERS):
    return client.post(
        "/media",
        data={"alt_text": alt_text},
        files={"file": ("diagram.png", data, content_type)},
        headers=headers,
    )


def test_upload_stores_what_cloudinary_reports(client, db_session, fake_cloudinary):
    response = post_image(client)

    assert response.status_code == 201
    body = response.json()
    assert body["url"].startswith("https://res.cloudinary.com/demo-cloud/")
    assert (body["width"], body["height"]) == (1200, 800)
    assert body["content_type"] == "image/png"
    assert body["size_bytes"] == len(PNG)
    assert body["alt_text"] == "A diagram"
    assert "public_id" not in body

    row = db_session.get(Media, body["id"])
    assert re.fullmatch(r"portfolio/a-diagram-[0-9a-f]{12}", row.public_id)


def test_upload_sends_bytes_and_credentials_from_settings(client, fake_cloudinary):
    post_image(client)

    [(file, options)] = fake_cloudinary.uploads
    # A str would make the SDK read a local path or fetch a URL.
    assert isinstance(file, bytes)
    assert options["cloud_name"] == "demo-cloud"
    assert options["api_key"] == "123456789012345"
    assert options["api_secret"] == SECRET
    assert options["resource_type"] == "image"
    assert options["asset_folder"] == "portfolio"


def test_upload_requires_admin(client, fake_cloudinary):
    response = post_image(client, headers={})

    assert response.status_code == 401
    assert fake_cloudinary.uploads == []


def test_upload_is_503_when_cloudinary_is_not_configured(client):
    # conftest blanks CLOUDINARY_URL; no fake_cloudinary here.
    response = post_image(client)

    assert response.status_code == 503


def test_oversized_file_is_413_and_never_uploaded(client, fake_cloudinary):
    response = post_image(client, data=b"x" * (media_service.MAX_UPLOAD_BYTES + 1))

    assert response.status_code == 413
    assert fake_cloudinary.uploads == []


def test_file_at_the_limit_is_accepted(client, fake_cloudinary):
    response = post_image(client, data=b"x" * media_service.MAX_UPLOAD_BYTES)

    assert response.status_code == 201


def test_svg_is_415_and_never_uploaded(client, fake_cloudinary):
    response = post_image(client, data=b"<svg/>", content_type="image/svg+xml")

    assert response.status_code == 415
    assert fake_cloudinary.uploads == []


def test_file_cloudinary_cannot_read_is_415(client, fake_cloudinary):
    fake_cloudinary.upload_error = cloudinary.exceptions.BadRequest("Invalid image file")

    response = post_image(client)

    assert response.status_code == 415


def test_cloudinary_outage_is_502(client, db_session, fake_cloudinary):
    fake_cloudinary.upload_error = cloudinary.exceptions.GeneralError("Server error")

    response = post_image(client)

    assert response.status_code == 502
    assert db_session.query(Media).count() == 0


def test_declared_type_that_turns_out_otherwise_is_415_and_deleted(client, db_session, fake_cloudinary):
    # Declared as PNG, but Cloudinary found an SVG.
    fake_cloudinary.format = "svg"

    response = post_image(client)

    assert response.status_code == 415
    [(_, options)] = fake_cloudinary.uploads
    assert fake_cloudinary.destroyed == [options["public_id"]]
    assert db_session.query(Media).count() == 0


def test_failed_database_write_deletes_the_uploaded_file(client, db_session, fake_cloudinary, monkeypatch):
    def broken_commit():
        raise IntegrityError("INSERT", {}, Exception("boom"))

    monkeypatch.setattr(db_session, "commit", broken_commit)

    with pytest.raises(IntegrityError):
        post_image(client)

    [(_, options)] = fake_cloudinary.uploads
    assert fake_cloudinary.destroyed == [options["public_id"]]


@pytest.mark.parametrize("alt_text", ["", "   ", "x" * 301])
def test_bad_alt_text_is_422_and_never_uploaded(client, fake_cloudinary, alt_text):
    response = post_image(client, alt_text=alt_text)

    assert response.status_code == 422
    assert fake_cloudinary.uploads == []


def test_alt_text_is_stored_trimmed(client, fake_cloudinary):
    response = post_image(client, alt_text="  A diagram  ")

    assert response.json()["alt_text"] == "A diagram"


@pytest.mark.parametrize(
    ("alt_text", "slug"),
    [
        ("Café diagram (v2)!", "cafe-diagram-v2"),
        ("  ---Architecture: API → DB---  ", "architecture-api-db"),
        ("日本語", "image"),
        ("word " * 30, ("word-" * 12).rstrip("-")),
    ],
)
def test_public_id_is_a_slug_of_the_alt_text(alt_text, slug):
    public_id = media_service._public_id(alt_text)

    assert re.fullmatch(rf"portfolio/{re.escape(slug)}-[0-9a-f]{{12}}", public_id)


def test_public_id_that_already_exists_fails_without_deleting_it(client, db_session, fake_cloudinary):
    fake_cloudinary.existing = True

    response = post_image(client)

    assert response.status_code == 502
    assert fake_cloudinary.destroyed == []
    assert db_session.query(Media).count() == 0


def test_admin_media_lists_newest_first(client, fake_cloudinary):
    first = post_image(client, alt_text="First").json()
    second = post_image(client, alt_text="Second").json()

    response = client.get("/admin/media", headers=ADMIN_HEADERS)

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [second["id"], first["id"]]


def test_admin_media_requires_admin(client):
    assert client.get("/admin/media").status_code == 401


# --- PATCH /media/{id} ---


def test_alt_text_can_be_edited_without_touching_the_file(client, fake_cloudinary):
    uploaded = post_image(client, alt_text="Old text").json()

    response = client.patch(f"/media/{uploaded['id']}", json={"alt_text": "  New text "}, headers=ADMIN_HEADERS)

    assert response.status_code == 200
    assert response.json()["alt_text"] == "New text"
    # Same file and URL: content that already embeds the image keeps working.
    assert response.json()["url"] == uploaded["url"]
    assert len(fake_cloudinary.uploads) == 1
    assert fake_cloudinary.destroyed == []
    listed = client.get("/admin/media", headers=ADMIN_HEADERS).json()
    assert listed[0]["alt_text"] == "New text"


def test_editing_alt_text_requires_admin(client, fake_cloudinary):
    uploaded = post_image(client).json()

    assert client.patch(f"/media/{uploaded['id']}", json={"alt_text": "New"}).status_code == 401


def test_editing_missing_media_is_404(client):
    assert client.patch("/media/999", json={"alt_text": "New"}, headers=ADMIN_HEADERS).status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {"alt_text": "   "},
        {"alt_text": "x" * 301},
        {},
        # Only alt text is editable; anything else is refused, not ignored.
        {"alt_text": "New", "public_id": "portfolio/other"},
    ],
)
def test_bad_media_update_is_422(client, fake_cloudinary, body):
    uploaded = post_image(client).json()

    response = client.patch(f"/media/{uploaded['id']}", json=body, headers=ADMIN_HEADERS)

    assert response.status_code == 422


# --- DELETE /media/{id} ---


def delete_image(client, media_id, headers=ADMIN_HEADERS):
    return client.delete(f"/media/{media_id}", headers=headers)


def test_delete_removes_the_file_then_the_row(client, db_session, fake_cloudinary):
    uploaded = post_image(client).json()
    public_id = db_session.get(Media, uploaded["id"]).public_id

    response = delete_image(client, uploaded["id"])

    assert response.status_code == 204
    assert fake_cloudinary.destroyed == [public_id]
    assert db_session.query(Media).count() == 0


def test_delete_requires_admin(client, db_session, fake_cloudinary):
    uploaded = post_image(client).json()

    assert delete_image(client, uploaded["id"], headers={}).status_code == 401
    assert fake_cloudinary.destroyed == []
    assert db_session.query(Media).count() == 1


def test_deleting_missing_media_is_404(client, fake_cloudinary):
    assert delete_image(client, 999).status_code == 404
    assert fake_cloudinary.destroyed == []


@pytest.mark.parametrize(
    "fake_setup",
    [
        {"destroy_result": "not found"},
        {"destroy_error": cloudinary.exceptions.NotFound("Resource not found")},
    ],
)
def test_file_already_gone_from_cloudinary_still_deletes_the_row(client, db_session, fake_cloudinary, fake_setup):
    # e.g. removed in the Cloudinary console, or a retry after a failed commit.
    uploaded = post_image(client).json()
    for name, value in fake_setup.items():
        setattr(fake_cloudinary, name, value)

    assert delete_image(client, uploaded["id"]).status_code == 204
    assert db_session.query(Media).count() == 0


@pytest.mark.parametrize(
    "fake_setup",
    [
        {"destroy_error": cloudinary.exceptions.GeneralError("Server error")},
        {"destroy_result": "error"},
    ],
)
def test_cloudinary_failure_on_delete_is_502_and_keeps_the_row(client, db_session, fake_cloudinary, fake_setup):
    # The row stays so the delete can be retried; nothing points at the file otherwise.
    uploaded = post_image(client).json()
    for name, value in fake_setup.items():
        setattr(fake_cloudinary, name, value)

    assert delete_image(client, uploaded["id"]).status_code == 502
    assert db_session.query(Media).count() == 1


def test_delete_is_503_when_cloudinary_is_not_configured(client, db_session, fake_cloudinary, monkeypatch):
    uploaded = post_image(client).json()
    monkeypatch.setattr(settings, "cloudinary_url", SecretStr(""))

    assert delete_image(client, uploaded["id"]).status_code == 503
    assert db_session.query(Media).count() == 1


def test_image_used_in_site_text_is_409_and_kept(client, db_session, fake_cloudinary):
    uploaded = post_image(client).json()
    item = db_session.get(Media, uploaded["id"])
    markdown = f"![{item.alt_text}]({item.url})"
    # A resized URL still names the same file.
    resized = item.url.replace("/upload/", "/upload/w_400/")
    make_project(db_session, slug="beta", case_study_md=f"Intro\n\n{markdown}")
    make_project(db_session, slug="alpha", summary=f"![x]({resized})", published=False)
    make_project(db_session, slug="unrelated")
    db_session.add(SiteContent(key="home.intro", value=markdown))
    db_session.commit()

    response = delete_image(client, item.id)

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Still used in project alpha, project beta, content home.intro; remove it there first"
    )
    assert fake_cloudinary.destroyed == []
    assert db_session.query(Media).count() == 1


def test_usage_search_treats_like_wildcards_literally(db_session):
    # "_" would match any one character in LIKE if it weren't escaped.
    item = make_media("portfolio/a_b")
    db_session.add(item)
    make_project(db_session, slug="near-miss", case_study_md="portfolio/aXb")
    db_session.commit()

    assert media_service.find_usages(db_session, item) == []
