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


RESEND_API_URL = "https://api.resend.com/emails"


def _describe_error_body(response: httpx2.Response) -> str:
    """Short, log-safe description of a notification service's error response.

    Discord's and Resend's own errors are JSON, so the first 200 characters
    are enough. A block from Cloudflare (which fronts Discord) is a full HTML
    page, where the first 200 characters are just markup; its <title> names
    the error.
    """
    text = response.text
    if text.lstrip()[:15].lower().startswith(("<!doctype", "<html")):
        match = re.search(r"<title>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
        title = " ".join(match.group(1).split())[:150] if match else "no title"
        return f"[HTML page: {title}]"
    return text[:200]


def _log_notification_failure(channel: str, exc: httpx2.HTTPError | httpx2.InvalidURL) -> None:
    """Log why a notification failed, without leaking credentials.

    A service's error status and body (e.g. 401 "Invalid Webhook Token")
    say what is wrong and don't contain our URL or key. Other errors log only
    the exception type, because httpx error messages can include the webhook
    URL, which is a secret.
    """
    if isinstance(exc, httpx2.HTTPStatusError):
        logger.warning(
            "%s notification failed: HTTP %s %s",
            channel,
            exc.response.status_code,
            _describe_error_body(exc.response),
        )
    else:
        logger.warning("%s notification failed: %s", channel, type(exc).__name__)


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
    except (httpx2.HTTPError, httpx2.InvalidURL) as exc:
        # The message is already saved; never fail the request over a
        # notification.
        _log_notification_failure("Discord", exc)


def notify_email(name: str, email: str, message: str) -> None:
    if not (settings.resend_api_key and settings.notify_email_to):
        return
    try:
        response = httpx2.post(
            RESEND_API_URL,
            json={
                "from": settings.email_from,
                "to": [settings.notify_email_to],
                # Replying to the notification goes straight to the visitor.
                "reply_to": email,
                # Collapse whitespace so a name can't inject line breaks.
                "subject": f"New contact message from {' '.join(name.split())[:100]}",
                "text": f"Name: {name}\nEmail: {email}\n\n{message}",
            },
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            timeout=10,
        )
        response.raise_for_status()
    except (httpx2.HTTPError, httpx2.InvalidURL) as exc:
        _log_notification_failure("Email", exc)


@router.post("", response_model=schemas.ContactConfirmation, status_code=201)
def submit_contact_message(payload: schemas.ContactCreate, background_tasks: BackgroundTasks ,db: Session = Depends(get_db)):
    message = models.ContactMessage(**payload.model_dump())
    db.add(message)
    db.commit()
    db.refresh(message)
    background_tasks.add_task(notify_discord, payload.name, payload.email, payload.message)
    background_tasks.add_task(notify_email, payload.name, payload.email, payload.message)
    return message
