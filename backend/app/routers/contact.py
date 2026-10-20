import logging
import re

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

# Discord's API docs require a User-Agent of this form and say requests
# without one may be blocked with a Cloudflare error (httpx2's default
# doesn't match it).
DISCORD_USER_AGENT = "DiscordBot (https://github.com/AlexLe08/the-portfolio-site, 1.0)"


def _describe_error_body(response: httpx2.Response) -> str:
    """Short, log-safe description of a Discord error response.

    Discord's own errors are JSON, so the first 200 characters are enough.
    A block from Cloudflare (which fronts Discord) is a full HTML page, where
    the first 200 characters are just markup; its <title> names the error.
    """
    text = response.text
    if text.lstrip()[:15].lower().startswith(("<!doctype", "<html")):
        match = re.search(r"<title>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
        title = " ".join(match.group(1).split())[:150] if match else "no title"
        return f"[HTML page: {title}]"
    return text[:200]

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
            headers={"User-Agent": DISCORD_USER_AGENT},
            timeout=5,
        )
        response.raise_for_status()
    except httpx2.HTTPStatusError as exc:
        # Discord answered with an error. Its status and response body (e.g.
        # 401 "Invalid Webhook Token") say what is wrong and don't contain the
        # webhook URL. Must come before the HTTPError clause below, since
        # HTTPStatusError is a subclass of HTTPError.
        logger.warning(
            "Discord notification failed: HTTP %s %s",
            exc.response.status_code,
            _describe_error_body(exc.response),
        )
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
