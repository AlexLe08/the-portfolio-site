import logging

import httpx2
import pytest

from app.routers import contact

WEBHOOK_URL = "https://discord.example/api/webhooks/123/secret-token"


def _payload(**overrides):
    return {"name": "Jamie", "email": "jamie@example.com", "message": "Hi there", **overrides}


@pytest.fixture()
def webhook_calls(monkeypatch):
    """Configure a webhook URL and record httpx2.post calls instead of sending them."""
    calls = []

    def fake_post(url, **kwargs):
        calls.append({"url": url, **kwargs})
        return httpx2.Response(204, request=httpx2.Request("POST", url))

    monkeypatch.setattr(contact.settings, "discord_webhook_url", WEBHOOK_URL)
    monkeypatch.setattr(contact.httpx2, "post", fake_post)
    return calls


def test_submit_contact_message(client):
    response = client.post(
        "/contact",
        json={"name": "Jamie", "email": "jamie@example.com", "message": "Hi there"},
    )

    assert response.status_code == 201
    assert "id" in response.json()


def test_submit_contact_message_rejects_invalid_email(client):
    response = client.post(
        "/contact",
        json={"name": "Jamie", "email": "not-an-email", "message": "Hi there"},
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": ""},
        {"name": "x" * 201},
        {"message": ""},
        {"message": "x" * 4001},
    ],
    ids=["empty-name", "name-too-long", "empty-message", "message-too-long"],
)
def test_submit_contact_message_rejects_out_of_range_lengths(client, overrides):
    response = client.post("/contact", json=_payload(**overrides))

    assert response.status_code == 422


@pytest.mark.parametrize(
    "overrides",
    [{"name": "x" * 200}, {"message": "x" * 4000}],
    ids=["name-at-limit", "message-at-limit"],
)
def test_submit_contact_message_accepts_lengths_at_the_limit(client, overrides):
    response = client.post("/contact", json=_payload(**overrides))

    assert response.status_code == 201


def test_no_webhook_call_when_url_not_configured(client, monkeypatch):
    calls = []
    monkeypatch.setattr(contact.settings, "discord_webhook_url", "")
    monkeypatch.setattr(contact.httpx2, "post", lambda *a, **kw: calls.append(a))

    response = client.post("/contact", json=_payload())

    assert response.status_code == 201
    assert calls == []


def test_webhook_receives_submitted_message(client, webhook_calls):
    response = client.post("/contact", json=_payload())

    assert response.status_code == 201
    assert len(webhook_calls) == 1
    call = webhook_calls[0]
    assert call["url"] == WEBHOOK_URL
    embed = call["json"]["embeds"][0]
    assert embed["description"] == "Hi there"
    assert {f["name"]: f["value"] for f in embed["fields"]} == {
        "Name": "Jamie",
        "Email": "jamie@example.com",
    }
    assert call["json"]["allowed_mentions"] == {"parse": []}
    assert call["timeout"] == 5


def test_webhook_delivers_longest_allowed_message_in_full(client, webhook_calls):
    message = "a" * 4000

    client.post("/contact", json=_payload(message=message))

    assert webhook_calls[0]["json"]["embeds"][0]["description"] == message


def test_largest_allowed_submission_fits_discord_embed_limits(client, webhook_calls):
    # Discord: description <= 4096, field values <= 1024, and all embed text
    # combined <= 6000. A bigger payload makes Discord reject the whole post.
    long_email = "a" * 64 + "@" + "b" * 63 + "." + "c" * 63 + ".com"
    client.post(
        "/contact",
        json=_payload(name="n" * 200, email=long_email, message="m" * 4000),
    )

    embed = webhook_calls[0]["json"]["embeds"][0]
    assert len(embed["description"]) <= 4096
    assert all(len(f["name"]) <= 256 and len(f["value"]) <= 1024 for f in embed["fields"])
    total = (
        len(embed["title"])
        + len(embed["description"])
        + sum(len(f["name"]) + len(f["value"]) for f in embed["fields"])
    )
    assert total <= 6000


def test_webhook_connection_error_does_not_fail_the_request(client, monkeypatch, caplog):
    def failing_post(url, **kwargs):
        raise httpx2.ConnectError(f"cannot connect to {url}")

    monkeypatch.setattr(contact.settings, "discord_webhook_url", WEBHOOK_URL)
    monkeypatch.setattr(contact.httpx2, "post", failing_post)

    with caplog.at_level(logging.WARNING, logger=contact.logger.name):
        response = client.post("/contact", json=_payload())

    assert response.status_code == 201
    assert "ConnectError" in caplog.text
    assert "secret-token" not in caplog.text


def test_webhook_error_status_and_body_are_logged_without_leaking_the_url(client, monkeypatch, caplog):
    def unauthorized_post(url, **kwargs):
        return httpx2.Response(
            401,
            json={"message": "Invalid Webhook Token", "code": 50027},
            request=httpx2.Request("POST", url),
        )

    monkeypatch.setattr(contact.settings, "discord_webhook_url", WEBHOOK_URL)
    monkeypatch.setattr(contact.httpx2, "post", unauthorized_post)

    with caplog.at_level(logging.WARNING, logger=contact.logger.name):
        response = client.post("/contact", json=_payload())

    assert response.status_code == 201
    assert "HTTP 401" in caplog.text
    assert "Invalid Webhook Token" in caplog.text
    assert "secret-token" not in caplog.text


def test_webhook_error_body_in_log_is_truncated(client, monkeypatch, caplog):
    def noisy_post(url, **kwargs):
        return httpx2.Response(
            500, text="x" * 1000, request=httpx2.Request("POST", url)
        )

    monkeypatch.setattr(contact.settings, "discord_webhook_url", WEBHOOK_URL)
    monkeypatch.setattr(contact.httpx2, "post", noisy_post)

    with caplog.at_level(logging.WARNING, logger=contact.logger.name):
        client.post("/contact", json=_payload())

    assert "HTTP 500" in caplog.text
    assert "x" * 200 in caplog.text
    assert "x" * 201 not in caplog.text
