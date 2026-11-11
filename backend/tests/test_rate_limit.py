import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.core.rate_limit import SlidingWindowLimiter
from app.routers import contact
from tests.helpers import contact_payload


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

    statuses = [client.post("/contact", json=contact_payload()).status_code for _ in range(3)]
    blocked = client.post("/contact", json=contact_payload())

    assert statuses == [201, 201, 429]
    assert int(blocked.headers["Retry-After"]) > 0
    assert "Too many" in blocked.json()["detail"]


def test_retry_after_is_readable_cross_origin(client, monkeypatch):
    # The middleware reads ALLOWED_ORIGINS once at import, so use whichever
    # origin is configured rather than assuming localhost.
    origin = settings.allowed_origins_list[0]
    monkeypatch.setattr(contact.limiter, "limit", 1)

    client.post("/contact", json=contact_payload())
    blocked = client.post("/contact", json=contact_payload(), headers={"Origin": origin})

    assert blocked.status_code == 429
    assert blocked.headers["Access-Control-Allow-Origin"] == origin
    assert "retry-after" in blocked.headers["Access-Control-Expose-Headers"].lower()


@pytest.mark.parametrize(
    "field",
    ["contact_rate_limit", "contact_rate_window_seconds", "login_rate_limit", "login_rate_window_seconds"],
)
def test_zero_rate_settings_fail_at_startup(field):
    with pytest.raises(ValidationError, match="greater than 0"):
        Settings(**{field: 0})


def test_rate_limited_submission_is_not_saved(client, db_session, monkeypatch):
    monkeypatch.setattr(contact.limiter, "limit", 1)
    client.post("/contact", json=contact_payload())
    client.post("/contact", json=contact_payload())

    assert db_session.query(contact.models.ContactMessage).count() == 1


def test_honeypot_submissions_count_toward_the_limit(client, monkeypatch):
    monkeypatch.setattr(contact.limiter, "limit", 1)
    client.post("/contact", json=contact_payload(website="x"))

    assert client.post("/contact", json=contact_payload()).status_code == 429


@pytest.mark.parametrize(
    ("header_setting", "ips", "expected"),
    [
        ("CF-Connecting-IP", ["1.1.1.1", "2.2.2.2", "1.1.1.1"], [201, 201, 429]),
        # Without the setting, a forged header can't buy a fresh limit.
        ("", ["1.1.1.1", "2.2.2.2"], [201, 429]),
        # A request without the configured header is keyed by the peer address.
        ("CF-Connecting-IP", [None, None], [201, 429]),
    ],
    ids=["told-apart", "forged-ignored", "fallback"],
)
def test_client_key_for_the_limit(client, monkeypatch, header_setting, ips, expected):
    monkeypatch.setattr(contact.settings, "client_ip_header", header_setting)
    monkeypatch.setattr(contact.limiter, "limit", 1)

    def post(ip):
        headers = {} if ip is None else {"CF-Connecting-IP": ip}
        return client.post("/contact", json=contact_payload(), headers=headers)

    assert [post(ip).status_code for ip in ips] == expected
