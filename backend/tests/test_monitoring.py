import json

import pytest
import sentry_sdk
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sentry_sdk.transport import Transport

from app.core import monitoring
from app.core.config import settings
from tests.helpers import ADMIN_KEY


class CapturingTransport(Transport):
    """Keeps events in memory instead of sending them to sentry.io."""

    def __init__(self):
        super().__init__()
        self.events = []

    def capture_envelope(self, envelope):
        event = envelope.get_event()
        if event is not None:
            self.events.append(event)


@pytest.fixture()
def sentry_events(monkeypatch):
    """Turn Sentry on for one test, with every event captured locally."""
    transport = CapturingTransport()
    real_init = sentry_sdk.init
    monkeypatch.setattr(
        monitoring.sentry_sdk, "init", lambda **options: real_init(transport=transport, **options)
    )
    monkeypatch.setattr(settings, "sentry_dsn", "https://public@o0.ingest.sentry.io/0")
    monkeypatch.setattr(settings, "render_git_commit", "abc123")
    assert monitoring.init_sentry()
    yield transport.events
    real_init()  # no DSN: reporting is off again for the other tests


def crashing_app() -> TestClient:
    # Built after init_sentry(), like app.main, so the SDK has hooked into
    # FastAPI. A separate app keeps test-only routes out of the real one.
    app = FastAPI()

    @app.post("/crash")
    def crash(payload: dict):
        config = settings  # a local whose repr holds every secret
        raise RuntimeError(f"crashed with {len(payload)} fields and {type(config).__name__}")

    @app.get("/missing")
    def missing():
        raise HTTPException(404, "Not found")

    return TestClient(app, raise_server_exceptions=False)


def test_off_without_dsn(monkeypatch):
    def fail(**options):
        raise AssertionError("sentry_sdk.init should not be called")

    monkeypatch.setattr(monitoring.sentry_sdk, "init", fail)
    monkeypatch.setattr(settings, "sentry_dsn", "")
    assert monitoring.init_sentry() is False


def test_unhandled_error_is_reported(sentry_events):
    response = crashing_app().post("/crash", json={"name": "Visitor"})

    assert response.status_code == 500
    [event] = sentry_events
    assert event["exception"]["values"][-1]["type"] == "RuntimeError"
    assert event["environment"] == settings.environment
    assert event["release"] == "abc123"


def test_report_leaves_out_secrets_and_visitor_data(sentry_events):
    crashing_app().post(
        "/crash",
        json={"email": "visitor@example.com", "message": "a private message"},
        headers={"X-Admin-Key": ADMIN_KEY, "Authorization": "Bearer session-token"},
    )

    [event] = sentry_events
    sent = json.dumps(event)
    # ADMIN_KEY would also appear if the `config` local were captured.
    for secret in (ADMIN_KEY, "session-token", "visitor@example.com", "a private message"):
        assert secret not in sent
    assert "ip_address" not in event.get("user", {})


def test_client_errors_are_not_reported(sentry_events):
    response = crashing_app().get("/missing")

    assert response.status_code == 404
    assert sentry_events == []
