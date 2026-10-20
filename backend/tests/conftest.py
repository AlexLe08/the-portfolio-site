import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.database import Base, get_db
from app.main import app


@pytest.fixture(autouse=True)
def no_real_notifications(monkeypatch):
    """
    Settings are read from the developer's real .env, which may hold a live
    Discord webhook or Resend key. Blank them for every test so nothing can
    send a real notification; tests that need one set it explicitly.
    """
    monkeypatch.setattr(settings, "discord_webhook_url", "")
    monkeypatch.setattr(settings, "resend_api_key", "")
    monkeypatch.setattr(settings, "notify_email_to", "")


@pytest.fixture(autouse=True)
def fresh_contact_rate_limit(monkeypatch):
    """The contact limiter is module-level state; don't let tests share it."""
    from app.routers import contact

    monkeypatch.setattr(settings, "client_ip_header", "")
    contact.limiter.reset()
    yield
    contact.limiter.reset()


@pytest.fixture()
def db_session():
    """
    A fresh, in-memory SQLite database, created and torn down per test.
    This is the isolation your Discord bot's persistence layer eventually
    got, applied from day one here: tests can never leak state into each
    other, and never touch dev.db, because each test gets an engine that
    exists only in this process's memory and disappears when the test
    function returns.
    """
    # StaticPool matters here: SQLite's `:memory:` DB is per-connection by
    # default, so SQLAlchemy's normal pooling would hand create_all() one
    # in-memory database and each query a *different* one -- "table
    # doesn't exist" errors that have nothing to do with your actual code.
    # StaticPool forces every checkout to reuse the same connection.
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
    """
    FastAPI lets you swap out a dependency for the lifetime of a test via
    `dependency_overrides`. Here we replace the real get_db (which reads
    DATABASE_URL and would hit dev.db / production) with one that always
    hands back this test's isolated in-memory session -- so route code
    under test doesn't need to know it's being tested at all.
    """
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
