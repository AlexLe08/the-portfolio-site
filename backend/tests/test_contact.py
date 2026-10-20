import logging
import re

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


EMAIL_KEY = "re_test_secret_key"
EMAIL_TO = "me@example.com"


@pytest.fixture()
def email_calls(monkeypatch):
    """Configure Resend and record httpx2.post calls instead of sending them."""
    calls = []

    def fake_post(url, **kwargs):
        calls.append({"url": url, **kwargs})
        return httpx2.Response(200, json={"id": "abc"}, request=httpx2.Request("POST", url))

    monkeypatch.setattr(contact.settings, "resend_api_key", EMAIL_KEY)
    monkeypatch.setattr(contact.settings, "notify_email_to", EMAIL_TO)
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
    # Discord requires "DiscordBot ($url, $version)"; see contact.DISCORD_USER_AGENT.
    assert re.fullmatch(r"DiscordBot \(\S+, \S+\)", call["headers"]["User-Agent"])
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


def test_cloudflare_html_error_page_is_logged_by_its_title(client, monkeypatch, caplog):
    page = (
        "<!doctype html>\n<!--[if lt IE 7]> <html class='no-js ie6 oldie'> <![endif]-->\n"
        "<html><head>\n<title>Access denied | discord.com used Cloudflare to "
        "restrict access</title>\n</head><body>" + "padding " * 200 + "</body></html>"
    )

    def blocked_post(url, **kwargs):
        return httpx2.Response(429, text=page, request=httpx2.Request("POST", url))

    monkeypatch.setattr(contact.settings, "discord_webhook_url", WEBHOOK_URL)
    monkeypatch.setattr(contact.httpx2, "post", blocked_post)

    with caplog.at_level(logging.WARNING, logger=contact.logger.name):
        response = client.post("/contact", json=_payload())

    assert response.status_code == 201
    assert "HTTP 429" in caplog.text
    assert "Access denied | discord.com used Cloudflare to restrict access" in caplog.text
    assert "<!doctype" not in caplog.text.lower()
    assert "padding" not in caplog.text


def test_html_error_page_without_title_is_still_logged_safely(client, monkeypatch, caplog):
    def blocked_post(url, **kwargs):
        return httpx2.Response(
            403, text="<html><body>blocked</body></html>", request=httpx2.Request("POST", url)
        )

    monkeypatch.setattr(contact.settings, "discord_webhook_url", WEBHOOK_URL)
    monkeypatch.setattr(contact.httpx2, "post", blocked_post)

    with caplog.at_level(logging.WARNING, logger=contact.logger.name):
        client.post("/contact", json=_payload())

    assert "HTTP 403 [HTML page: no title]" in caplog.text


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


@pytest.mark.parametrize(
    "key, to",
    [("", EMAIL_TO), (EMAIL_KEY, ""), ("", "")],
    ids=["no-key", "no-recipient", "neither"],
)
def test_no_email_sent_unless_key_and_recipient_are_both_set(client, monkeypatch, key, to):
    calls = []
    monkeypatch.setattr(contact.settings, "resend_api_key", key)
    monkeypatch.setattr(contact.settings, "notify_email_to", to)
    monkeypatch.setattr(contact.httpx2, "post", lambda *a, **kw: calls.append(a))

    response = client.post("/contact", json=_payload())

    assert response.status_code == 201
    assert calls == []


def test_email_notification_payload(client, email_calls):
    response = client.post("/contact", json=_payload())

    assert response.status_code == 201
    assert len(email_calls) == 1
    call = email_calls[0]
    assert call["url"] == contact.RESEND_API_URL
    assert call["headers"] == {"Authorization": f"Bearer {EMAIL_KEY}"}
    body = call["json"]
    assert body["to"] == [EMAIL_TO]
    assert body["from"] == contact.settings.email_from
    assert body["reply_to"] == "jamie@example.com"
    assert body["subject"] == "New contact message from Jamie"
    assert "Hi there" in body["text"]
    assert "Jamie" in body["text"] and "jamie@example.com" in body["text"]


def test_email_subject_cannot_contain_line_breaks(client, email_calls):
    client.post("/contact", json=_payload(name="Jamie\r\nBcc: evil@example.com"))

    subject = email_calls[0]["json"]["subject"]
    assert "\n" not in subject and "\r" not in subject


def test_email_error_status_is_logged_without_leaking_the_key(client, monkeypatch, caplog):
    def forbidden_post(url, **kwargs):
        return httpx2.Response(
            403,
            json={"name": "validation_error", "message": "You can only send testing emails to your own email address"},
            request=httpx2.Request("POST", url),
        )

    monkeypatch.setattr(contact.settings, "resend_api_key", EMAIL_KEY)
    monkeypatch.setattr(contact.settings, "notify_email_to", EMAIL_TO)
    monkeypatch.setattr(contact.httpx2, "post", forbidden_post)

    with caplog.at_level(logging.WARNING, logger=contact.logger.name):
        response = client.post("/contact", json=_payload())

    assert response.status_code == 201
    assert "Email notification failed: HTTP 403" in caplog.text
    assert "only send testing emails" in caplog.text
    assert EMAIL_KEY not in caplog.text


def test_email_connection_error_does_not_fail_the_request(client, monkeypatch, caplog):
    def failing_post(url, **kwargs):
        raise httpx2.ConnectError(f"cannot connect, key {EMAIL_KEY}")

    monkeypatch.setattr(contact.settings, "resend_api_key", EMAIL_KEY)
    monkeypatch.setattr(contact.settings, "notify_email_to", EMAIL_TO)
    monkeypatch.setattr(contact.httpx2, "post", failing_post)

    with caplog.at_level(logging.WARNING, logger=contact.logger.name):
        response = client.post("/contact", json=_payload())

    assert response.status_code == 201
    assert "Email notification failed: ConnectError" in caplog.text
    assert EMAIL_KEY not in caplog.text


def test_discord_failure_does_not_stop_the_email(client, monkeypatch, caplog):
    sent = []

    def post(url, **kwargs):
        if url == WEBHOOK_URL:
            return httpx2.Response(429, text="<html><title>Access denied</title></html>", request=httpx2.Request("POST", url))
        sent.append(url)
        return httpx2.Response(200, json={"id": "abc"}, request=httpx2.Request("POST", url))

    monkeypatch.setattr(contact.settings, "discord_webhook_url", WEBHOOK_URL)
    monkeypatch.setattr(contact.settings, "resend_api_key", EMAIL_KEY)
    monkeypatch.setattr(contact.settings, "notify_email_to", EMAIL_TO)
    monkeypatch.setattr(contact.httpx2, "post", post)

    with caplog.at_level(logging.WARNING, logger=contact.logger.name):
        response = client.post("/contact", json=_payload())

    assert response.status_code == 201
    assert "Discord notification failed: HTTP 429" in caplog.text
    assert sent == [contact.RESEND_API_URL]
