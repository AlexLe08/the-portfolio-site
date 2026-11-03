import os

# app.main starts Sentry when it's imported, below, which is too early for
# a monkeypatch fixture. An environment variable outranks .env, so this
# keeps a real SENTRY_DSN from reporting test crashes.
os.environ["SENTRY_DSN"] = ""

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.database import Base, get_db
from app.main import app


@pytest.fixture(autouse=True)
def pinned_settings(monkeypatch):
    """
    Settings are read from the developer's real .env, which may hold a live
    Discord webhook, Resend key, or Cloudinary URL, a real admin key, or a
    login. Pin every one of them so nothing can send a real notification or
    upload to the live account; tests that need one set it explicitly.
    """
    from tests.helpers import ADMIN_KEY

    monkeypatch.setattr(settings, "discord_webhook_url", "")
    monkeypatch.setattr(settings, "resend_api_key", "")
    monkeypatch.setattr(settings, "notify_email_to", "")
    monkeypatch.setattr(settings, "cloudinary_url", SecretStr(""))
    # Tests send tests.helpers.ADMIN_KEY.
    monkeypatch.setattr(settings, "admin_api_key", ADMIN_KEY)
    # Login is off unless a test turns it on (see tests/test_auth.py).
    monkeypatch.setattr(settings, "admin_password_hash", "")
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "client_ip_header", "")


@pytest.fixture(autouse=True)
def fresh_rate_limits():
    """The limiters are module-level state; don't let tests share it."""
    from app.routers import auth, contact

    for limiter in (contact.limiter, auth.limiter):
        limiter.reset()
    yield
    for limiter in (contact.limiter, auth.limiter):
        limiter.reset()


@pytest.fixture()
def db_session():
    """A fresh in-memory SQLite database per test, so tests never share
    state or touch dev.db."""
    # SQLite's :memory: database is per connection; StaticPool makes every
    # checkout reuse one connection, so create_all() and the queries see the
    # same database.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    """The app with get_db swapped for this test's in-memory session."""
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
