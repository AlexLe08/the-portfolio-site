from datetime import datetime, timedelta, timezone

import jwt
import pytest
from argon2 import PasswordHasher
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.core.security import create_admin_token
from app.routers import auth

PASSWORD = "correct horse battery staple"
SECRET = "test-secret-that-is-at-least-32-bytes-long"
# Minimum argon2 cost so each verify is fast; the parameters are stored in
# the hash itself, so the app's default PasswordHasher still checks it.
PASSWORD_HASH = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1).hash(PASSWORD)

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


def test_expired_token_is_rejected(client, login_enabled):
    long_ago = datetime.now(timezone.utc) - timedelta(days=2)
    token, _ = create_admin_token(now=long_ago)

    response = client.put(PROTECTED, json=BODY, headers=_bearer(token))

    assert response.status_code == 401


def test_token_signed_with_another_secret_is_rejected(client, login_enabled):
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    token = jwt.encode({"sub": "admin", "exp": exp}, "x" * 32 + "-other-secret", algorithm="HS256")

    response = client.put(PROTECTED, json=BODY, headers=_bearer(token))

    assert response.status_code == 401


def test_unsigned_token_is_rejected(client, login_enabled):
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    token = jwt.encode({"sub": "admin", "exp": exp}, None, algorithm="none")

    response = client.put(PROTECTED, json=BODY, headers=_bearer(token))

    assert response.status_code == 401


def test_token_for_another_subject_is_rejected(client, login_enabled):
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    token = jwt.encode({"sub": "someone-else", "exp": exp}, SECRET, algorithm="HS256")

    response = client.put(PROTECTED, json=BODY, headers=_bearer(token))

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


def test_missing_credentials_ask_for_a_bearer_token(client):
    response = client.put(PROTECTED, json=BODY)

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_short_jwt_secret_fails_at_startup():
    with pytest.raises(ValidationError, match="at least 32 bytes"):
        Settings(jwt_secret="too-short")
