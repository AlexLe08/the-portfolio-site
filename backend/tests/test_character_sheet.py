import copy
import json
import re
from pathlib import Path

import pytest

from app import models
from app.services import character_sheet
from app.services.character_sheet import ConfigTooLarge, InvalidConfig
from tests.helpers import ADMIN_HEADERS

REPO = Path(__file__).resolve().parents[2]
FRONTEND = REPO / "frontend"
BUNDLED_CONFIG = json.loads((FRONTEND / "lib/character-config.json").read_text(encoding="utf-8"))
PACKAGE = REPO / "packages/eorzean-character-sheet"
PACKAGE_SCHEMA = PACKAGE / "character-sheet.schema.json"


@pytest.fixture()
def config():
    """The frontend's bundled config: real content, and valid by definition."""
    return copy.deepcopy(BUNDLED_CONFIG)


def issues_by_path(config):
    return {
        ".".join(map(str, issue.path)): issue.message
        for issue in character_sheet.find_issues(config)
    }


def test_schema_copy_matches_package():
    # Fails when schema.ts changed without `npm run generate:character-schema`
    # (which regenerates the package's file and copies it here).
    assert character_sheet.SCHEMA_PATH.read_bytes() == PACKAGE_SCHEMA.read_bytes()


def test_schema_has_versioned_id():
    # The package's README promises this URL, pinned to a major version, so
    # other tools can fetch the schema. The schema has no $refs (zod inlines
    # everything), so an absolute $id doesn't change how validation resolves.
    schema = json.loads(character_sheet.SCHEMA_PATH.read_text(encoding="utf-8"))
    package = json.loads((PACKAGE / "package.json").read_text(encoding="utf-8"))

    match = re.fullmatch(
        r"https://cdn\.jsdelivr\.net/npm/@alexle08/eorzean-character-sheet@(\d+)"
        r"/character-sheet\.schema\.json",
        schema["$id"],
    )
    assert match
    # A major version bump without regenerating would leave the old @N.
    assert match.group(1) == package["version"].split(".")[0]


def test_bundled_config_is_valid(config):
    assert character_sheet.find_issues(config) == []


def test_reports_problem_at_its_path(config):
    config["jobs"][0]["level"]["value"] = ""

    assert issues_by_path(config) == {"jobs.0.level.value": "'' should be non-empty"}


def test_slot_action_reports_errors_from_the_branch_its_kind_selects(config):
    # jsonschema's best_match() would blame the anchor branch's "target".
    config["jobs"][0]["slots"]["core"]["action"] = {"kind": "link", "href": "//elsewhere.example"}

    issues = character_sheet.find_issues(config)

    assert [(issue.path[-1], issue.kind) for issue in issues] == [("href", "pattern")]


def test_slot_action_reports_missing_field_for_its_kind(config):
    config["jobs"][0]["slots"]["core"]["action"] = {"kind": "anchor"}

    assert issues_by_path(config) == {
        "jobs.0.slots.core.action": "'target' is a required property"
    }


def test_slot_action_with_unknown_kind_lists_the_allowed_kinds(config):
    config["jobs"][0]["slots"]["core"]["action"] = {"kind": "teleport"}

    assert issues_by_path(config) == {
        "jobs.0.slots.core.action.kind": 'must be one of "anchor", "link", "external", "none"'
    }


@pytest.mark.parametrize(
    "href",
    ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,hi", "ftp://example.com"],
)
def test_external_links_must_be_http_or_https(config, href):
    config["jobs"][0]["slots"]["core"]["action"] = {"kind": "external", "href": href}

    issues = character_sheet.find_issues(config)

    assert [(issue.path[-1], issue.kind) for issue in issues] == [("href", "pattern")]


def test_external_https_link_is_valid(config):
    config["jobs"][0]["slots"]["core"]["action"] = {
        "kind": "external",
        "href": "https://github.com/AlexLe08",
        "newTab": True,
    }

    assert character_sheet.find_issues(config) == []


def test_issues_are_in_path_order_with_numeric_indexes(config):
    jobs = [copy.deepcopy(config["jobs"][0]) for _ in range(11)]
    for index, job in enumerate(jobs):
        job["id"] = f"job-{index}"
    jobs[2]["name"] = ""
    jobs[10]["name"] = ""
    config["jobs"] = jobs

    paths = [issue.path for issue in character_sheet.find_issues(config)]

    assert paths == [["jobs", 2, "name"], ["jobs", 10, "name"]]


def test_reported_issues_are_capped(config):
    config["slots"] = [{"id": "Not Valid", "label": "", "position": "middle"}] * 20

    issues = character_sheet.find_issues(config)

    assert len(issues) == character_sheet.MAX_REPORTED_ERRORS


def test_get_config_is_none_until_saved(db_session):
    assert character_sheet.get_config(db_session) is None


def test_save_creates_the_row(db_session, config):
    row = character_sheet.save_config(db_session, config)

    assert row.id == character_sheet.ROW_ID
    assert row.config == config
    assert row.updated_at is not None


def test_save_replaces_the_row_and_keeps_key_order(db_session, config):
    character_sheet.save_config(db_session, config)
    config["title"] = "Updated"
    reordered = {"jobs": config["jobs"], **config}

    character_sheet.save_config(db_session, reordered)

    db_session.expire_all()
    stored = character_sheet.get_config(db_session)
    assert db_session.query(models.CharacterSheet).count() == 1
    assert stored.config["title"] == "Updated"
    assert list(stored.config) == list(reordered)


def test_invalid_config_is_rejected_and_not_stored(db_session, config):
    config["defaultJobId"] = "Not An Id"

    with pytest.raises(InvalidConfig) as raised:
        character_sheet.save_config(db_session, config)

    assert [issue.path for issue in raised.value.issues] == [["defaultJobId"]]
    assert character_sheet.get_config(db_session) is None


def test_oversized_config_is_rejected_before_validation(db_session, config, monkeypatch):
    monkeypatch.setattr(character_sheet, "MAX_CONFIG_BYTES", 100)

    with pytest.raises(ConfigTooLarge):
        character_sheet.save_config(db_session, config)

    assert character_sheet.get_config(db_session) is None


# --- Routes (admin credentials are checked for every route in test_auth.py) ---


def test_get_is_404_until_saved(client):
    response = client.get("/character-sheet")

    assert response.status_code == 404


def test_put_saves_and_get_returns_it_publicly(client, config):
    response = client.put("/character-sheet", json={"config": config}, headers=ADMIN_HEADERS)

    assert response.status_code == 200
    assert response.json()["config"] == config
    assert "updated_at" in response.json()
    stored = client.get("/character-sheet")
    assert stored.status_code == 200
    assert stored.json()["config"] == config


def test_put_is_idempotent(client, config):
    for _ in range(2):
        client.put("/character-sheet", json={"config": config}, headers=ADMIN_HEADERS)

    assert client.get("/character-sheet").json()["config"] == config


def test_put_reports_invalid_config_like_fastapi_validation_errors(client, config):
    config["jobs"][0]["level"]["value"] = ""

    response = client.put("/character-sheet", json={"config": config}, headers=ADMIN_HEADERS)

    assert response.status_code == 422
    assert response.json() == {
        "detail": [
            {
                "type": "minLength",
                "loc": ["body", "config", "jobs", 0, "level", "value"],
                "msg": "'' should be non-empty",
            }
        ]
    }
    assert client.get("/character-sheet").status_code == 404


def test_put_rejects_a_config_that_is_not_an_object(client):
    for body in ({"config": []}, {"config": "{}"}, {}):
        response = client.put("/character-sheet", json=body, headers=ADMIN_HEADERS)
        assert response.status_code == 422, body


def test_put_rejects_unknown_fields(client, config):
    response = client.put(
        "/character-sheet", json={"config": config, "id": 2}, headers=ADMIN_HEADERS
    )

    assert response.status_code == 422


def test_put_rejects_oversized_config(client, config, monkeypatch):
    monkeypatch.setattr(character_sheet, "MAX_CONFIG_BYTES", 1024)

    response = client.put("/character-sheet", json={"config": config}, headers=ADMIN_HEADERS)

    assert response.status_code == 413
    assert response.json() == {"detail": "The config can be at most 1 KB"}
