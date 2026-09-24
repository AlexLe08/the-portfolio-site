from fastapi import Header, HTTPException, status

from app.core.config import settings


def require_admin_key(x_admin_key: str = Header(...)) -> None:
    """
    Deliberately simple: one shared secret, checked against a request
    header, for a site with exactly one admin (you). Full JWT/OAuth would
    be the right call the moment there's more than one writer, or a
    browser-based login flow — but building that here would be complexity
    with no one to spend it on. Worth saying out loud in an interview:
    this is a scoped, intentional trade-off, not a shortcut you didn't
    notice.
    """
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin key")
