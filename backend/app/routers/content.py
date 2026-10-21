from fastapi import APIRouter, Depends, Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.security import require_admin_key
from app.database import get_db

router = APIRouter(prefix="/content", tags=["content"])


@router.get("", response_model=dict[str, str])
def list_content(db: Session = Depends(get_db)):
    # A flat {key: value} map rather than a list: the frontend looks values
    # up by key and falls back to built-in text when one is missing.
    return {row.key: row.value for row in db.scalars(select(models.SiteContent))}


@router.put(
    "/{key}",
    response_model=schemas.ContentEntry,
    dependencies=[Depends(require_admin_key)],
)
def put_content(
    payload: schemas.ContentUpdate,
    key: str = Path(max_length=100, pattern=schemas.CONTENT_KEY_PATTERN),
    db: Session = Depends(get_db),
):
    # PUT replaces the whole value at this key, creating it if needed, so
    # sending the same request twice leaves the same result.
    entry = db.get(models.SiteContent, key)
    if entry is None:
        entry = models.SiteContent(key=key, value=payload.value)
        db.add(entry)
    else:
        entry.value = payload.value
    db.commit()
    db.refresh(entry)
    return entry
