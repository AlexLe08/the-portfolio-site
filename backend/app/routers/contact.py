import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.rate_limit import SlidingWindowLimiter


from app import models, schemas
from app.database import get_db
from app.services import notifications

router = APIRouter(prefix="/contact", tags=["contact"])
logger = logging.getLogger(__name__)

limiter = SlidingWindowLimiter(
    settings.contact_rate_limit, settings.contact_rate_window_seconds
)


def _client_key(request: Request) -> str:
    """Identify the visitor for rate limiting (see Settings.client_ip_header)."""
    if settings.client_ip_header:
        value = request.headers.get(settings.client_ip_header, "").strip()
        if value:
            # The value is client-influenced; keep stored keys small.
            return value[:100]
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(request: Request) -> None:
    retry_after = limiter.check(_client_key(request))
    if retry_after:
        raise HTTPException(
            status_code=429,
            detail="Too many messages. Please try again later.",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )


@router.post(
    "",
    response_model=schemas.ContactConfirmation,
    status_code=201,
    dependencies=[Depends(enforce_rate_limit)],
)
def submit_contact_message(payload: schemas.ContactCreate, background_tasks: BackgroundTasks ,db: Session = Depends(get_db)):
    if payload.website:
        # Honeypot tripped. Answer exactly like a success so the bot has no
        # signal to adapt to, but save and notify nothing.
        # warning, not info: the root logger's default level is WARNING and
        # uvicorn doesn't change it, so info would never reach the logs.
        logger.warning("Contact honeypot tripped; submission discarded")
        return schemas.ContactConfirmation(id=0, created_at=datetime.now(timezone.utc))

    message = models.ContactMessage(**payload.model_dump(exclude={"website"}))
    db.add(message)
    db.commit()
    db.refresh(message)
    background_tasks.add_task(notifications.notify_discord, payload.name, payload.email, payload.message)
    background_tasks.add_task(notifications.notify_email, payload.name, payload.email, payload.message)
    return message
