import hmac
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

JWT_ALGORITHM = "HS256"
ADMIN_SUBJECT = "admin"

_password_hasher = PasswordHasher()

# auto_error=False on both: either credential may be absent, and
# require_admin decides what a request without one gets. Declaring them as
# security schemes (rather than plain Header params) also gives /docs an
# "Authorize" button that fills them in for every admin endpoint.
_bearer = HTTPBearer(auto_error=False, description="Session token from POST /auth/login")
_admin_key = APIKeyHeader(name="X-Admin-Key", auto_error=False, description="Shared admin key")


def login_configured() -> bool:
    return bool(settings.admin_password_hash and settings.jwt_secret)


def verify_admin_password(password: str) -> bool:
    # Settings already refuses a malformed ADMIN_PASSWORD_HASH at startup. Any
    # InvalidHashError that still gets here is left to surface as a 500: it's
    # a deployment mistake, not a wrong password.
    try:
        return _password_hasher.verify(settings.admin_password_hash, password)
    except VerifyMismatchError:
        return False


def create_admin_token(now: datetime | None = None) -> tuple[str, datetime]:
    """Sign a session token for the admin. Returns the token and its expiry.

    Stateless: nothing is stored server-side, so a token can't be revoked
    before it expires. Changing JWT_SECRET invalidates every token at once,
    which is enough with one admin and sessions measured in hours.
    """
    now = now or datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.admin_session_minutes)
    claims = {"sub": ADMIN_SUBJECT, "iat": now, "exp": expires_at}
    return jwt.encode(claims, settings.jwt_secret, algorithm=JWT_ALGORITHM), expires_at


def _is_valid_admin_token(token: str) -> bool:
    if not settings.jwt_secret:
        return False
    try:
        # algorithms is pinned, never read from the token's own header:
        # trusting the header is how "alg: none" forgeries get accepted.
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
    except jwt.InvalidTokenError:  # also covers expired tokens
        return False
    return claims["sub"] == ADMIN_SUBJECT


def require_admin(
    bearer: HTTPAuthorizationCredentials | None = Depends(_bearer),
    admin_key: str | None = Depends(_admin_key),
) -> None:
    """
    Two ways in, for one admin. The admin UI sends the session token from
    POST /auth/login, held by the frontend's server so it never reaches
    browser JavaScript. curl and /docs keep using the shared X-Admin-Key.
    A credential that's present but wrong is rejected outright, never
    retried against the other kind.
    """
    if bearer is not None:
        if _is_valid_admin_token(bearer.credentials):
            return
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if admin_key is not None:
        # compare_digest takes the same time wherever the strings differ,
        # so response timing can't be used to guess the key one character
        # at a time.
        if settings.admin_api_key and hmac.compare_digest(
            admin_key.encode(), settings.admin_api_key.encode()
        ):
            return
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin key")
    raise HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
