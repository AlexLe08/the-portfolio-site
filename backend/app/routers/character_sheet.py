from collections.abc import Generator
from contextlib import contextmanager

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.core.security import require_admin
from app.database import get_db
from app.services import character_sheet

router = APIRouter(prefix="/character-sheet", tags=["character-sheet"])


@contextmanager
def _http_errors() -> Generator[None, None, None]:
    """Turn the character sheet service's exceptions into HTTP errors."""
    try:
        yield
    except character_sheet.ConfigTooLarge:
        raise HTTPException(
            413, f"The config can be at most {character_sheet.MAX_CONFIG_BYTES // 1024} KB"
        )
    except character_sheet.InvalidConfig as error:
        # The same shape as FastAPI's own 422s, so clients handle both alike.
        raise HTTPException(
            422,
            [
                {"type": issue.kind, "loc": ["body", "config", *issue.path], "msg": issue.message}
                for issue in error.issues
            ],
        )


@router.get("", response_model=schemas.CharacterSheetEntry)
def get_character_sheet(db: Session = Depends(get_db)):
    # 404 until the first save: the frontend then uses its bundled config.
    row = character_sheet.get_config(db)
    if row is None:
        raise HTTPException(404, "No character sheet saved yet")
    return row


@router.put(
    "",
    response_model=schemas.CharacterSheetEntry,
    dependencies=[Depends(require_admin)],
    responses={413: {"model": schemas.ErrorDetail, "description": "Config too large"}},
)
def put_character_sheet(payload: schemas.CharacterSheetUpdate, db: Session = Depends(get_db)):
    # PUT replaces the whole document, creating it on the first save, so
    # sending the same request twice leaves the same result.
    with _http_errors():
        return character_sheet.save_config(db, payload.config)
