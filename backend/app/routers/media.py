from collections.abc import Generator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.security import require_admin
from app.database import get_db
from app.dependencies import existing_media
from app.services import media

router = APIRouter(prefix="/media", tags=["media"])


@contextmanager
def _http_errors() -> Generator[None, None, None]:
    """Turn the media service's exceptions into HTTP errors."""
    try:
        yield
    except media.UploadsDisabled:
        raise HTTPException(503, "Uploads are not configured (CLOUDINARY_URL is empty)")
    except media.FileTooLarge:
        raise HTTPException(413, f"Images can be at most {media.MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    except media.UnsupportedImage:
        raise HTTPException(415, "Upload a JPEG, PNG, WebP, GIF, or AVIF image")
    except media.InUse as error:
        raise HTTPException(409, f"Still used in {', '.join(error.usages)}; remove it there first")
    except media.ProviderError:
        raise HTTPException(502, "The image host failed; try again")


# Plain defs, not async, wherever Cloudinary is called: FastAPI runs them in
# a worker thread, so a blocking call doesn't stall every other request.
@router.post(
    "",
    response_model=schemas.MediaRead,
    status_code=201,
    dependencies=[Depends(require_admin)],
)
def upload_media(
    fields: Annotated[schemas.MediaCreate, Form()],
    file: Annotated[UploadFile, File(description="JPEG, PNG, WebP, GIF, or AVIF, at most 4 MB")],
    db: Session = Depends(get_db),
):
    # One byte past the limit is enough to know it's too big, without
    # reading the whole of an oversized file into memory.
    data = file.file.read(media.MAX_UPLOAD_BYTES + 1)
    with _http_errors():
        return media.upload_image(
            db, data=data, content_type=file.content_type or "", alt_text=fields.alt_text
        )


@router.patch(
    "/{media_id}",
    response_model=schemas.MediaRead,
    dependencies=[Depends(require_admin)],
)
def update_media(
    payload: schemas.MediaUpdate,
    item: models.Media = Depends(existing_media),
    db: Session = Depends(get_db),
):
    item.alt_text = payload.alt_text
    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/{media_id}",
    status_code=204,
    dependencies=[Depends(require_admin)],
    # The admin UI shows this detail, which names where the image is used.
    responses={409: {"model": schemas.ErrorDetail, "description": "Still used in site text"}},
)
def delete_media(item: models.Media = Depends(existing_media), db: Session = Depends(get_db)):
    with _http_errors():
        media.delete_media(db, item)
