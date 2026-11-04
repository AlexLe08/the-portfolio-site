import copy
import json
from pathlib import Path

import pytest

from app import models
from app.services import character_sheet
from app.services.character_sheet import ConfigTooLarge, InvalidConfig

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
BUNDLED_CONFIG = json.loads((FRONTEND / "lib/character-config.json").read_text(encoding="utf-8"))
FRONTEND_SCHEMA = FRONTEND / "components/character-sheet/character-sheet.schema.json"


@pytest.fixture()
def config():
    """The frontend's bundled config: real content, and valid by definition."""
    return copy.deepcopy(BUNDLED_CONFIG)


def issues_by_path(config):
    return {
        ".".join(map(str, issue.path)): issue.message
        for issue in character_sheet.find_issues(config)
    }


def test_schema_copy_matches_frontend():
    # Fails when schema.ts changed without `npm run generate:character-schema`
    # (which regenerates the frontend file and copies it here).
    assert character_sheet.SCHEMA_PATH.read_bytes() == FRONTEND_SCHEMA.read_bytes()


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
