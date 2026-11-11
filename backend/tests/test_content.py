import pytest

from app import models
from tests.helpers import ADMIN_HEADERS


def make_entry(db_session, key="home.intro", value="Hello."):
    entry = models.SiteContent(key=key, value=value)
    db_session.add(entry)
    db_session.commit()
    return entry


def test_list_content_returns_empty_map_when_nothing_stored(client):
    response = client.get("/content")

    assert response.status_code == 200
    assert response.json() == {}


def test_list_content_returns_key_value_map(client, db_session):
    make_entry(db_session, key="home.intro", value="Intro text.")
    make_entry(db_session, key="home.fact.location", value="Worcester, MA")

    response = client.get("/content")

    assert response.json() == {
        "home.intro": "Intro text.",
        "home.fact.location": "Worcester, MA",
    }


def test_put_content_creates_missing_key(client):
    response = client.put(
        "/content/contact.intro", json={"value": "Say hello."}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 200
    body = response.json()
    assert body["key"] == "contact.intro"
    assert body["value"] == "Say hello."
    assert "updated_at" in body
    assert client.get("/content").json() == {"contact.intro": "Say hello."}


def test_put_content_replaces_existing_value(client, db_session):
    make_entry(db_session, key="home.intro", value="Old.")

    response = client.put(
        "/content/home.intro", json={"value": "New."}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 200
    assert client.get("/content").json() == {"home.intro": "New."}


def test_put_content_is_idempotent(client):
    for _ in range(2):
        client.put("/content/home.intro", json={"value": "Same."}, headers=ADMIN_HEADERS)

    assert client.get("/content").json() == {"home.intro": "Same."}


@pytest.mark.parametrize(
    "bad_key",
    ["Home.Intro", "home..intro", ".home", "home.", "home-intro", "a" * 101],
    ids=["uppercase", "empty-segment", "leading-dot", "trailing-dot", "hyphen", "too-long"],
)
def test_put_content_rejects_malformed_keys(client, bad_key):
    response = client.put(f"/content/{bad_key}", json={"value": "x"}, headers=ADMIN_HEADERS)

    assert response.status_code == 422
    assert client.get("/content").json() == {}


def test_put_content_rejects_unknown_fields(client):
    response = client.put(
        "/content/home.intro",
        json={"value": "x", "key": "other.key"},
        headers=ADMIN_HEADERS,
    )

    assert response.status_code == 422
