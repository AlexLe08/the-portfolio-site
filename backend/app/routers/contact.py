from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/contact", tags=["contact"])


@router.post("", response_model=schemas.ContactConfirmation, status_code=201)
def submit_contact_message(payload: schemas.ContactCreate, db: Session = Depends(get_db)):
    message = models.ContactMessage(**payload.model_dump())
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
