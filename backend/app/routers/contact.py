import logging

import httpx2
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from app.core.config import settings


from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/contact", tags=["contact"])
logger = logging.getLogger(__name__)

# Discord rejects the whole post if an embed description exceeds this.
# schemas.ContactCreate caps messages below it; the slice below is a guard.
DISCORD_EMBED_DESCRIPTION_LIMIT = 4096

def notify_discord(name: str, email: str, message: str) -> None:
    if not settings.discord_webhook_url:
        return
    try:
        response = httpx2.post(
            settings.discord_webhook_url,
            json={
                "embeds": [
                    {
                        "title": "New contact message",
                        "description": message[:DISCORD_EMBED_DESCRIPTION_LIMIT],
                        "fields": [
                            {"name": "Name", "value": name, "inline": True},
                            {"name": "Email", "value": email, "inline": True},
                        ],
                    }
                ],
                # Visitor-supplied text: never let it ping anyone.
                "allowed_mentions": {"parse": []},
            },
            timeout=5,
        )
        response.raise_for_status()
    except (httpx2.HTTPError, httpx2.InvalidURL) as exc:
        # The message is already saved; never fail the request over a
        # notification. Log only the exception type: the webhook URL is a
        # secret and httpx error messages can include it.
        logger.warning("Discord notification failed: %s", type(exc).__name__)


@router.post("", response_model=schemas.ContactConfirmation, status_code=201)
def submit_contact_message(payload: schemas.ContactCreate, background_tasks: BackgroundTasks ,db: Session = Depends(get_db)):
    message = models.ContactMessage(**payload.model_dump())
    db.add(message)
    db.commit()
    db.refresh(message)
    background_tasks.add_task(notify_discord, payload.name, payload.email, payload.message)
    return message
