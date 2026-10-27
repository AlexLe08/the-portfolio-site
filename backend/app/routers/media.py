from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import schemas
from app.core.security import require_admin
from app.database import get_db
from app.services import media

router = APIRouter(prefix="/media", tags=["media"])


# A plain def, not async: FastAPI runs it in a worker thread, so the
# blocking Cloudinary call doesn't stall every other request meanwhile.
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
    try:
        return media.upload_image(
            db, data=data, content_type=file.content_type or "", alt_text=fields.alt_text
        )
    except media.UploadsDisabled:
        raise HTTPException(503, "Uploads are not configured (CLOUDINARY_URL is empty)")
    except media.FileTooLarge:
        raise HTTPException(413, f"Images can be at most {media.MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    except media.UnsupportedImage:
        raise HTTPException(415, "Upload a JPEG, PNG, WebP, GIF, or AVIF image")
    except media.ProviderError:
        raise HTTPException(502, "The image host failed; try again")
