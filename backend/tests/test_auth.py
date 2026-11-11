from datetime import datetime, timedelta, timezone

import re

import jwt
import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.core.security import create_admin_token
from app.main import app
from app.routers import auth
from tests.helpers import PASSWORD, PASSWORD_HASH

SECRET = "test-secret-that-is-at-least-32-bytes-long"

# Any admin-protected endpoint works; PUT /content needs no setup rows.
PROTECTED = "/content/home.intro"
BODY = {"value": "New."}


@pytest.fixture()
def login_enabled(monkeypatch):
    monkeypatch.setattr(settings, "admin_password_hash", PASSWORD_HASH)
    monkeypatch.setattr(settings, "jwt_secret", SECRET)


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_login_is_unavailable_until_configured(client):
    response = client.post("/auth/login", json={"password": PASSWORD})

    assert response.status_code == 503


def test_login_returns_a_token_that_expires(client, login_enabled):
    before = datetime.now(timezone.utc)
    response = client.post("/auth/login", json={"password": PASSWORD})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    expires_at = datetime.fromisoformat(body["expires_at"])
    expected = before + timedelta(minutes=settings.admin_session_minutes)
    assert abs(expires_at - expected) < timedelta(seconds=5)


def test_token_from_login_authorizes_admin_requests(client, login_enabled):
    token = client.post("/auth/login", json={"password": PASSWORD}).json()["access_token"]

    response = client.put(PROTECTED, json=BODY, headers=_bearer(token))

    assert response.status_code == 200


def test_wrong_password_is_rejected(client, login_enabled):
    response = client.post("/auth/login", json={"password": "wrong"})

    assert response.status_code == 401
    assert "access_token" not in response.json()


def test_oversized_password_is_rejected_before_hashing(client, login_enabled):
    response = client.post("/auth/login", json={"password": "x" * 257})

    assert response.status_code == 422


def test_login_attempts_are_rate_limited(client, login_enabled, monkeypatch):
    monkeypatch.setattr(auth.limiter, "limit", 2)

    statuses = [
        client.post("/auth/login", json={"password": "wrong"}).status_code for _ in range(2)
    ]
    blocked = client.post("/auth/login", json={"password": PASSWORD})

    assert statuses == [401, 401]
    # Once limited, even the right password waits: otherwise the limit
    # wouldn't slow down guessing at all.
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0


def _expired_token():
    token, _ = create_admin_token(now=datetime.now(timezone.utc) - timedelta(days=2))
    return token


def _token(sub, key, algorithm):
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode({"sub": sub, "exp": exp}, key, algorithm=algorithm)


# Factories, so expiry is relative to when the test runs, not collection.
@pytest.mark.parametrize(
    "make_token",
    [
        _expired_token,
        lambda: _token("admin", "x" * 32 + "-other-secret", "HS256"),
        lambda: _token("admin", None, "none"),
        lambda: _token("someone-else", SECRET, "HS256"),
    ],
    ids=["expired", "other-secret", "alg-none", "other-subject"],
)
def test_forged_or_stale_token_is_rejected(client, login_enabled, make_token):
    response = client.put(PROTECTED, json=BODY, headers=_bearer(make_token()))

    assert response.status_code == 401


def test_tokens_stop_working_when_login_is_turned_off(client, login_enabled, monkeypatch):
    token, _ = create_admin_token()
    monkeypatch.setattr(settings, "jwt_secret", "")

    response = client.put(PROTECTED, json=BODY, headers=_bearer(token))

    assert response.status_code == 401


def test_bad_token_does_not_fall_back_to_a_valid_admin_key(client, login_enabled):
    headers = {**_bearer("not-a-token"), "x-admin-key": settings.admin_api_key}

    response = client.put(PROTECTED, json=BODY, headers=headers)

    assert response.status_code == 401


def test_admin_key_still_works_alongside_login(client, login_enabled):
    response = client.put(PROTECTED, json=BODY, headers={"x-admin-key": settings.admin_api_key})

    assert response.status_code == 200


def test_short_jwt_secret_fails_at_startup():
    with pytest.raises(ValidationError, match="at least 32 bytes"):
        Settings(jwt_secret="too-short")


# --- Every admin route, found through the OpenAPI schema ---

# Routes anyone may call. Everything else must require admin credentials.
PUBLIC_OPERATIONS = {
    "GET /health",
    "GET /projects",
    "GET /projects/{slug}",
    "GET /content",
    "GET /character-sheet",
    "POST /contact",
    "POST /auth/login",
}

# require_admin declares the Bearer and X-Admin-Key schemes, so every
# operation that depends on it lists them under `security`.
OPERATIONS = {
    f"{method.upper()} {path}": operation
    for path, methods in app.openapi()["paths"].items()
    for method, operation in methods.items()
}
ADMIN_OPERATIONS = sorted(name for name, op in OPERATIONS.items() if "security" in op)


def test_every_route_is_public_or_admin_only():
    # A new route that forgot require_admin fails here until it is added to
    # PUBLIC_OPERATIONS on purpose.
    unprotected = {name for name, op in OPERATIONS.items() if "security" not in op}

    assert unprotected == PUBLIC_OPERATIONS


@pytest.mark.parametrize(
    "headers",
    [{}, {"x-admin-key": "wrong"}, _bearer("not-a-token")],
    ids=["no-credentials", "wrong-key", "bad-token"],
)
@pytest.mark.parametrize("operation", ADMIN_OPERATIONS)
def test_admin_routes_reject_bad_credentials(client, operation, headers):
    method, path = operation.split(" ")
    # Any path value: credentials are checked before the row is looked up,
    # so a missing row must not turn this into a 404.
    url = re.sub(r"\{\w+\}", "1", path)

    response = client.request(method, url, headers=headers)

    assert response.status_code == 401
    if not headers:
        assert response.headers["WWW-Authenticate"] == "Bearer"
