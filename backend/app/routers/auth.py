import logging

from fastapi import APIRouter, Depends, HTTPException

from app import schemas
from app.core.config import settings
from app.core.rate_limit import SlidingWindowLimiter, enforce_rate_limit
from app.core.security import create_admin_token, login_configured, verify_admin_password

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

limiter = SlidingWindowLimiter(settings.login_rate_limit, settings.login_rate_window_seconds)


def enforce_login_rate_limit() -> None:
    # Every attempt shares one key (see Settings.login_rate_limit). The cost
    # is that a flood of bad attempts locks the admin out of the UI for a
    # window too; the admin key still works from curl meanwhile.
    enforce_rate_limit(limiter, "login", "Too many login attempts. Please try again later.")


@router.post(
    "/login",
    response_model=schemas.AdminToken,
    dependencies=[Depends(enforce_login_rate_limit)],
)
def login(payload: schemas.AdminLogin):
    if not login_configured():
        raise HTTPException(503, "Login is not configured")
    if not verify_admin_password(payload.password):
        logger.warning("Admin login failed: wrong password")
        raise HTTPException(401, "Wrong password")
    token, expires_at = create_admin_token()
    return schemas.AdminToken(access_token=token, expires_at=expires_at)
