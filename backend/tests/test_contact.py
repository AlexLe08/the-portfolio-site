import logging
import re

import httpx2
import pytest

from app.routers import contact
from app.services import notifications
from tests.helpers import contact_payload

WEBHOOK_URL = "https://discord.example/api/webhooks/123/secret-token"
EMAIL_KEY = "re_test_secret_key"
EMAIL_TO = "me@example.com"


class FakePost:
    """Stands in for httpx2.post: records each call, never touches the network.

    Answers with `replies[url]` if set, else `reply` (keyword arguments for
    httpx2.Response); raises `error` instead when that is set.
    """

    def __init__(self):
        self.calls = []
        self.reply = {"status_code": 200, "json": {"id": "abc"}}
        self.replies = {}
        self.error = None

    def __call__(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        if self.error:
            raise self.error
        reply = self.replies.get(url, self.reply)
        return httpx2.Response(**reply, request=httpx2.Request("POST", url))


@pytest.fixture()
def posts(monkeypatch):
    fake = FakePost()
    monkeypatch.setattr(notifications.httpx2, "post", fake)
    return fake


@pytest.fixture()
def discord_posts(posts, monkeypatch):
    """Discord turned on; its posts land in the shared fake."""
    monkeypatch.setattr(notifications.settings, "discord_webhook_url", WEBHOOK_URL)
    return posts


@pytest.fixture()
def email_posts(posts, monkeypatch):
    """Resend turned on; its posts land in the shared fake."""
    monkeypatch.setattr(notifications.settings, "resend_api_key", EMAIL_KEY)
    monkeypatch.setattr(notifications.settings, "notify_email_to", EMAIL_TO)
    return posts


def test_submit_contact_message(client):
    response = client.post("/contact", json=contact_payload())

    assert response.status_code == 201
    assert "id" in response.json()


def test_submit_contact_message_rejects_invalid_email(client):
    response = client.post("/contact", json=contact_payload(email="not-an-email"))

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
    response = client.post("/contact", json=contact_payload(**overrides))

    assert response.status_code == 422


@pytest.mark.parametrize(
    "overrides",
    [{"name": "x" * 200}, {"message": "x" * 4000}],
    ids=["name-at-limit", "message-at-limit"],
)
def test_submit_contact_message_accepts_lengths_at_the_limit(client, overrides):
    response = client.post("/contact", json=contact_payload(**overrides))

    assert response.status_code == 201


def test_no_webhook_call_when_url_not_configured(client, posts):
    response = client.post("/contact", json=contact_payload())

    assert response.status_code == 201
    assert posts.calls == []


def test_webhook_receives_submitted_message(client, discord_posts):
    response = client.post("/contact", json=contact_payload())

    assert response.status_code == 201
    [call] = discord_posts.calls
    assert call["url"] == WEBHOOK_URL
    embed = call["json"]["embeds"][0]
    assert embed["description"] == "Hi there"
    assert {f["name"]: f["value"] for f in embed["fields"]} == {
        "Name": "Jamie",
        "Email": "jamie@example.com",
    }
    assert call["json"]["allowed_mentions"] == {"parse": []}
    # Discord requires "DiscordBot ($url, $version)"; see notifications.DISCORD_USER_AGENT.
    assert re.fullmatch(r"DiscordBot \(\S+, \S+\)", call["headers"]["User-Agent"])
    assert call["timeout"] == 5


def test_webhook_delivers_longest_allowed_message_in_full(client, discord_posts):
    message = "a" * 4000

    client.post("/contact", json=contact_payload(message=message))

    assert discord_posts.calls[0]["json"]["embeds"][0]["description"] == message


def test_largest_allowed_submission_fits_discord_embed_limits(client, discord_posts):
    # Discord: description <= 4096, field values <= 1024, and all embed text
    # combined <= 6000. A bigger payload makes Discord reject the whole post.
    long_email = "a" * 64 + "@" + "b" * 63 + "." + "c" * 63 + ".com"
    client.post(
        "/contact",
        json=contact_payload(name="n" * 200, email=long_email, message="m" * 4000),
    )

    embed = discord_posts.calls[0]["json"]["embeds"][0]
    assert len(embed["description"]) <= 4096
    assert all(len(f["name"]) <= 256 and len(f["value"]) <= 1024 for f in embed["fields"])
    total = (
        len(embed["title"])
        + len(embed["description"])
        + sum(len(f["name"]) + len(f["value"]) for f in embed["fields"])
    )
    assert total <= 6000


def test_webhook_connection_error_does_not_fail_the_request(client, discord_posts, caplog):
    discord_posts.error = httpx2.ConnectError(f"cannot connect to {WEBHOOK_URL}")

    with caplog.at_level(logging.WARNING, logger=notifications.logger.name):
        response = client.post("/contact", json=contact_payload())

    assert response.status_code == 201
    assert "ConnectError" in caplog.text
    assert "secret-token" not in caplog.text


def test_webhook_error_status_and_body_are_logged_without_leaking_the_url(client, discord_posts, caplog):
    discord_posts.reply = {
        "status_code": 401,
        "json": {"message": "Invalid Webhook Token", "code": 50027},
    }

    with caplog.at_level(logging.WARNING, logger=notifications.logger.name):
        response = client.post("/contact", json=contact_payload())

    assert response.status_code == 201
    assert "HTTP 401" in caplog.text
    assert "Invalid Webhook Token" in caplog.text
    assert "secret-token" not in caplog.text


def test_cloudflare_html_error_page_is_logged_by_its_title(client, discord_posts, caplog):
    page = (
        "<!doctype html>\n<!--[if lt IE 7]> <html class='no-js ie6 oldie'> <![endif]-->\n"
        "<html><head>\n<title>Access denied | discord.com used Cloudflare to "
        "restrict access</title>\n</head><body>" + "padding " * 200 + "</body></html>"
    )
    discord_posts.reply = {"status_code": 429, "text": page}

    with caplog.at_level(logging.WARNING, logger=notifications.logger.name):
        response = client.post("/contact", json=contact_payload())

    assert response.status_code == 201
    assert "HTTP 429" in caplog.text
    assert "Access denied | discord.com used Cloudflare to restrict access" in caplog.text
    assert "<!doctype" not in caplog.text.lower()
    assert "padding" not in caplog.text


def test_html_error_page_without_title_is_still_logged_safely(client, discord_posts, caplog):
    discord_posts.reply = {"status_code": 403, "text": "<html><body>blocked</body></html>"}

    with caplog.at_level(logging.WARNING, logger=notifications.logger.name):
        client.post("/contact", json=contact_payload())

    assert "HTTP 403 [HTML page: no title]" in caplog.text


def test_webhook_error_body_in_log_is_truncated(client, discord_posts, caplog):
    discord_posts.reply = {"status_code": 500, "text": "x" * 1000}

    with caplog.at_level(logging.WARNING, logger=notifications.logger.name):
        client.post("/contact", json=contact_payload())

    assert "HTTP 500" in caplog.text
    assert "x" * 200 in caplog.text
    assert "x" * 201 not in caplog.text


@pytest.mark.parametrize(
    "key, to",
    [("", EMAIL_TO), (EMAIL_KEY, ""), ("", "")],
    ids=["no-key", "no-recipient", "neither"],
)
def test_no_email_sent_unless_key_and_recipient_are_both_set(client, posts, monkeypatch, key, to):
    monkeypatch.setattr(notifications.settings, "resend_api_key", key)
    monkeypatch.setattr(notifications.settings, "notify_email_to", to)

    response = client.post("/contact", json=contact_payload())

    assert response.status_code == 201
    assert posts.calls == []


def test_email_notification_payload(client, email_posts):
    response = client.post("/contact", json=contact_payload())

    assert response.status_code == 201
    [call] = email_posts.calls
    assert call["url"] == notifications.RESEND_API_URL
    assert call["headers"] == {"Authorization": f"Bearer {EMAIL_KEY}"}
    body = call["json"]
    assert body["to"] == [EMAIL_TO]
    assert body["from"] == notifications.settings.email_from
    assert body["reply_to"] == "jamie@example.com"
    assert body["subject"] == "New contact message from Jamie"
    assert "Hi there" in body["text"]
    assert "Jamie" in body["text"] and "jamie@example.com" in body["text"]


def test_email_subject_cannot_contain_line_breaks(client, email_posts):
    client.post("/contact", json=contact_payload(name="Jamie\r\nBcc: evil@example.com"))

    subject = email_posts.calls[0]["json"]["subject"]
    assert "\n" not in subject and "\r" not in subject


def test_email_error_status_is_logged_without_leaking_the_key(client, email_posts, caplog):
    email_posts.reply = {
        "status_code": 403,
        "json": {
            "name": "validation_error",
            "message": "You can only send testing emails to your own email address",
        },
    }

    with caplog.at_level(logging.WARNING, logger=notifications.logger.name):
        response = client.post("/contact", json=contact_payload())

    assert response.status_code == 201
    assert "Email notification failed: HTTP 403" in caplog.text
    assert "only send testing emails" in caplog.text
    assert EMAIL_KEY not in caplog.text


def test_email_connection_error_does_not_fail_the_request(client, email_posts, caplog):
    email_posts.error = httpx2.ConnectError(f"cannot connect, key {EMAIL_KEY}")

    with caplog.at_level(logging.WARNING, logger=notifications.logger.name):
        response = client.post("/contact", json=contact_payload())

    assert response.status_code == 201
    assert "Email notification failed: ConnectError" in caplog.text
    assert EMAIL_KEY not in caplog.text


def test_discord_failure_does_not_stop_the_email(client, posts, discord_posts, email_posts, caplog):
    posts.replies[WEBHOOK_URL] = {
        "status_code": 429,
        "text": "<html><title>Access denied</title></html>",
    }

    with caplog.at_level(logging.WARNING, logger=notifications.logger.name):
        response = client.post("/contact", json=contact_payload())

    assert response.status_code == 201
    assert "Discord notification failed: HTTP 429" in caplog.text
    # Discord is tried first, so the email really was sent after the failure.
    assert [call["url"] for call in posts.calls] == [WEBHOOK_URL, notifications.RESEND_API_URL]
    assert "Email notification failed" not in caplog.text


def test_honeypot_submission_looks_successful_but_is_discarded(client, db_session, discord_posts):
    response = client.post("/contact", json=contact_payload(website="http://spam.example"))

    assert response.status_code == 201
    assert set(response.json()) == {"id", "created_at"}
    assert db_session.query(contact.models.ContactMessage).count() == 0
    assert discord_posts.calls == []


def test_honeypot_trip_is_logged_without_the_submission(client, caplog):
    with caplog.at_level(logging.WARNING, logger=contact.logger.name):
        client.post("/contact", json=contact_payload(message="secret body", website="x"))

    assert "honeypot tripped" in caplog.text
    assert "secret body" not in caplog.text


def test_honeypot_submission_sends_no_email(client, email_posts):
    client.post("/contact", json=contact_payload(website="x"))

    assert email_posts.calls == []


def test_empty_honeypot_is_saved_normally(client, db_session):
    response = client.post("/contact", json=contact_payload(website=""))

    assert response.status_code == 201
    assert db_session.query(contact.models.ContactMessage).count() == 1
