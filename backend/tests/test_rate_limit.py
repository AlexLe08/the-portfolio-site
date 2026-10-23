import pytest

from app.core.config import settings
from app.core.rate_limit import SlidingWindowLimiter
from app.routers import contact


def _payload(**overrides):
    return {"name": "Jamie", "email": "jamie@example.com", "message": "Hi", **overrides}


def test_allows_up_to_the_limit_then_reports_the_wait():
    limiter = SlidingWindowLimiter(limit=2, window=100)

    assert limiter.check("a", now=0) == 0
    assert limiter.check("a", now=10) == 0
    assert limiter.check("a", now=20) == pytest.approx(80)


def test_window_slides_so_old_hits_expire():
    limiter = SlidingWindowLimiter(limit=1, window=100)
    limiter.check("a", now=0)

    assert limiter.check("a", now=99) > 0
    assert limiter.check("a", now=101) == 0


def test_rejected_hits_do_not_extend_the_wait():
    limiter = SlidingWindowLimiter(limit=1, window=100)
    limiter.check("a", now=0)
    limiter.check("a", now=50)  # rejected

    assert limiter.check("a", now=101) == 0


def test_keys_are_limited_independently():
    limiter = SlidingWindowLimiter(limit=1, window=100)
    limiter.check("a", now=0)

    assert limiter.check("b", now=1) == 0


def test_tracked_keys_are_bounded():
    limiter = SlidingWindowLimiter(limit=1, window=100, max_keys=3)
    for i in range(10):
        limiter.check(f"k{i}", now=i)

    assert len(limiter._hits) <= 3


def test_expired_keys_are_pruned_before_live_ones_are_evicted():
    limiter = SlidingWindowLimiter(limit=1, window=10, max_keys=2)
    limiter.check("old", now=0)
    limiter.check("live", now=50)
    limiter.check("new", now=55)  # "old" expired; "live" must survive

    assert limiter.check("live", now=56) > 0


def test_contact_route_returns_429_after_the_limit(client, monkeypatch):
    monkeypatch.setattr(contact.limiter, "limit", 2)

    statuses = [client.post("/contact", json=_payload()).status_code for _ in range(3)]
    blocked = client.post("/contact", json=_payload())

    assert statuses == [201, 201, 429]
    assert int(blocked.headers["Retry-After"]) > 0
    assert "Too many" in blocked.json()["detail"]


def test_retry_after_is_readable_cross_origin(client, monkeypatch):
    # The middleware reads ALLOWED_ORIGINS once at import, so use whichever
    # origin is configured rather than assuming localhost.
    origin = settings.allowed_origins_list[0]
    monkeypatch.setattr(contact.limiter, "limit", 1)

    client.post("/contact", json=_payload())
    blocked = client.post("/contact", json=_payload(), headers={"Origin": origin})

    assert blocked.status_code == 429
    assert blocked.headers["Access-Control-Allow-Origin"] == origin
    assert "retry-after" in blocked.headers["Access-Control-Expose-Headers"].lower()


def test_rate_limited_submission_is_not_saved(client, db_session, monkeypatch):
    monkeypatch.setattr(contact.limiter, "limit", 1)
    client.post("/contact", json=_payload())
    client.post("/contact", json=_payload())

    assert db_session.query(contact.models.ContactMessage).count() == 1


def test_honeypot_submissions_count_toward_the_limit(client, monkeypatch):
    monkeypatch.setattr(contact.limiter, "limit", 1)
    client.post("/contact", json=_payload(website="x"))

    assert client.post("/contact", json=_payload()).status_code == 429


def test_visitors_are_told_apart_by_the_configured_header(client, monkeypatch):
    monkeypatch.setattr(contact.settings, "client_ip_header", "CF-Connecting-IP")
    monkeypatch.setattr(contact.limiter, "limit", 1)

    def post(ip):
        return client.post("/contact", json=_payload(), headers={"CF-Connecting-IP": ip})

    assert post("1.1.1.1").status_code == 201
    assert post("2.2.2.2").status_code == 201
    assert post("1.1.1.1").status_code == 429


def test_without_the_header_setting_forged_headers_are_ignored(client, monkeypatch):
    monkeypatch.setattr(contact.limiter, "limit", 1)

    def post(ip):
        return client.post("/contact", json=_payload(), headers={"CF-Connecting-IP": ip})

    assert post("1.1.1.1").status_code == 201
    assert post("2.2.2.2").status_code == 429


def test_missing_configured_header_falls_back_to_the_peer_address(client, monkeypatch):
    monkeypatch.setattr(contact.settings, "client_ip_header", "CF-Connecting-IP")
    monkeypatch.setattr(contact.limiter, "limit", 1)

    assert client.post("/contact", json=_payload()).status_code == 201
    assert client.post("/contact", json=_payload()).status_code == 429
