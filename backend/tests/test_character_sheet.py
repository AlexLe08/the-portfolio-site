import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from app import models
from app.services import character_sheet
from app.services.character_sheet import ConfigTooLarge, InvalidConfig
from tests.helpers import ADMIN_HEADERS

REPO = Path(__file__).resolve().parents[2]
FRONTEND = REPO / "frontend"
BUNDLED_CONFIG = json.loads((FRONTEND / "lib/character-config.json").read_text(encoding="utf-8"))


@pytest.fixture()
def config():
    """The frontend's bundled config: real content, and valid by definition."""
    return copy.deepcopy(BUNDLED_CONFIG)


def issues_by_path(config):
    return {
        ".".join(map(str, issue.path)): issue.message
        for issue in character_sheet.find_issues(config)
    }


def issue_kinds(config):
    return [(issue.path, issue.kind) for issue in character_sheet.find_issues(config)]


def set_action(config, action):
    config["jobs"][0]["slots"]["core"]["action"] = action


# Valid actions of each kind with options; the PUT test saves each one.
VALID_ACTIONS = [
    {"kind": "external", "href": "https://github.com/AlexLe08", "newTab": True},
    {"kind": "param", "name": "stack", "value": "fastapi", "target": "projects"},
    {"kind": "param", "name": "stack", "value": "fastapi"},
]


def test_bundled_config_is_valid(config):
    assert character_sheet.find_issues(config) == []


def test_reports_problem_at_its_path(config):
    config["jobs"][0]["level"]["value"] = ""

    assert issues_by_path(config) == {"jobs.0.level.value": "'' should be non-empty"}


def test_slot_action_reports_errors_from_the_branch_its_kind_selects(config):
    # jsonschema's best_match() would blame the anchor branch's "target".
    set_action(config, {"kind": "link", "href": "//elsewhere.example"})

    issues = character_sheet.find_issues(config)

    assert [(issue.path[-1], issue.kind) for issue in issues] == [("href", "pattern")]


def test_slot_action_reports_missing_field_for_its_kind(config):
    set_action(config, {"kind": "anchor"})

    assert issues_by_path(config) == {
        "jobs.0.slots.core.action": "'target' is a required property"
    }


def test_slot_action_with_unknown_kind_lists_the_allowed_kinds(config):
    set_action(config, {"kind": "teleport"})

    assert issues_by_path(config) == {
        "jobs.0.slots.core.action.kind": 'must be one of "anchor", "link", "external", "param", "none"'
    }


@pytest.mark.parametrize(
    "href",
    ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,hi", "ftp://example.com"],
)
def test_external_links_must_be_http_or_https(config, href):
    set_action(config, {"kind": "external", "href": href})

    issues = character_sheet.find_issues(config)

    assert [(issue.path[-1], issue.kind) for issue in issues] == [("href", "pattern")]


@pytest.mark.parametrize("name", ["job", "Stack Filter"])
def test_param_action_name_must_match_the_pattern(config, name):
    # "job" picks the job, so a param action may not set it. The issue being
    # at action.name shows the kind picked the param branch.
    set_action(config, {"kind": "param", "name": name, "value": "x"})

    assert issue_kinds(config) == [
        (["jobs", 0, "slots", "core", "action", "name"], "pattern")
    ]


def test_param_action_reports_a_missing_value(config):
    set_action(config, {"kind": "param", "name": "stack"})

    assert issues_by_path(config) == {
        "jobs.0.slots.core.action": "'value' is a required property"
    }


def test_param_action_value_has_a_max_length(config):
    set_action(config, {"kind": "param", "name": "stack", "value": "x" * 81})

    assert issue_kinds(config) == [
        (["jobs", 0, "slots", "core", "action", "value"], "maxLength")
    ]


@pytest.mark.parametrize(
    "action",
    [
        {"kind": "param", "name": "stack", "value": "fastapi", "href": "/"},
        {"kind": "none", "href": "/"},
    ],
    ids=["param", "none"],
)
def test_slot_action_with_a_key_from_another_kind_names_the_key(config, action):
    set_action(config, action)

    assert issues_by_path(config) == {
        "jobs.0.slots.core.action.href": "not in the schema (a typo?)"
    }
    assert issue_kinds(config) == [
        (["jobs", 0, "slots", "core", "action", "href"], "additionalProperties")
    ]


def test_schema_closes_every_object():
    # Closed objects are what make a typo in an admin save an error rather
    # than a key the frontend silently drops. Records (propertyNames) keep
    # a schema for their values instead of false.
    schema = json.loads(character_sheet.SCHEMA_PATH.read_text(encoding="utf-8"))
    objects = records = 0

    def walk(node):
        nonlocal objects, records
        if isinstance(node, dict):
            if "properties" in node:
                objects += 1
                assert node.get("additionalProperties") is False, node
            if "propertyNames" in node:
                records += 1
                assert isinstance(node.get("additionalProperties"), dict), node
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(schema)
    assert objects > 0 and records > 0


def test_unknown_key_is_reported_at_its_own_path(config):
    config["jobs"][0]["slots"]["core"]["tooltip"]["subtitel"] = "Core stack"

    issues = character_sheet.find_issues(config)

    assert issues_by_path(config) == {
        "jobs.0.slots.core.tooltip.subtitel": "not in the schema (a typo?)"
    }
    assert [issue.kind for issue in issues] == ["additionalProperties"]


def test_each_unknown_key_in_one_object_is_its_own_issue_in_document_order(config):
    level = config["jobs"][0]["level"]
    level["valeu"] = "4 years"
    level["lable"] = "Lv."

    paths = [issue.path for issue in character_sheet.find_issues(config)]

    assert paths == [["jobs", 0, "level", "valeu"], ["jobs", 0, "level", "lable"]]


def test_unknown_top_level_key_is_reported(config):
    config["$schema"] = "./character-sheet.schema.json"
    config["titel"] = "Character"

    assert issues_by_path(config) == {"titel": "not in the schema (a typo?)"}


def test_top_level_schema_key_is_allowed(config):
    config["$schema"] = "./character-sheet.schema.json"

    assert character_sheet.find_issues(config) == []


def test_slot_action_without_kind_keeps_the_oneof_error(config):
    # Every branch is still possible without a "kind", so none is picked.
    set_action(config, {"href": "/"})

    issues = character_sheet.find_issues(config)

    assert [(issue.path[-1], issue.kind) for issue in issues] == [("action", "oneOf")]


def test_unknown_keys_respect_pattern_properties_and_missing_properties():
    # The exported schema has neither case today; z.object({}) or a zod
    # record with a key pattern would produce them.
    schema = {"type": "object", "patternProperties": {"^x-": {}}, "additionalProperties": False}
    [error] = Draft202012Validator(schema).iter_errors({"x-note": 1, "extra": 2})

    issues = character_sheet._explain(error)

    assert [(issue.path, issue.kind) for issue in issues] == [(["extra"], "additionalProperties")]


def test_tooltip_pair_item_with_unknown_key_names_the_key(config):
    items = config["jobs"][0]["slots"]["skills"]["tooltip"]["items"]
    items[1]["years"] = "4"

    assert issues_by_path(config) == {
        "jobs.0.slots.skills.tooltip.items.1.years": "not in the schema (a typo?)"
    }


def test_tooltip_pair_item_reports_errors_from_the_pair_branch(config):
    # A wrong type inside the pair is not a type error on the item itself,
    # so the pair branch is still the one that matched.
    items = config["jobs"][0]["slots"]["skills"]["tooltip"]["items"]
    items[0]["label"] = 5

    assert issue_kinds(config) == [
        (["jobs", 0, "slots", "skills", "tooltip", "items", 0, "label"], "type")
    ]


def test_tooltip_string_item_reports_errors_from_the_string_branch(config):
    config["jobs"][0]["slots"]["skills"]["tooltip"]["items"] = [""]

    assert issues_by_path(config) == {
        "jobs.0.slots.skills.tooltip.items.0": "'' should be non-empty"
    }


def test_tooltip_item_of_neither_type_keeps_the_anyof_error(config):
    config["jobs"][0]["slots"]["skills"]["tooltip"]["items"] = [5]

    issues = character_sheet.find_issues(config)

    assert [(issue.path[-1], issue.kind) for issue in issues] == [(0, "anyOf")]


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


@pytest.mark.parametrize("action", VALID_ACTIONS, ids=["external", "param-target", "param"])
def test_put_saves_a_valid_action(client, config, action):
    set_action(config, action)

    response = client.put("/character-sheet", json={"config": config}, headers=ADMIN_HEADERS)

    assert response.status_code == 200
    assert response.json()["config"]["jobs"][0]["slots"]["core"]["action"] == action


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


def test_put_rejects_an_unknown_config_key_at_its_path(client, config):
    config["jobs"][0]["slots"]["core"]["tooltip"]["subtitel"] = "Core stack"

    response = client.put("/character-sheet", json={"config": config}, headers=ADMIN_HEADERS)

    assert response.status_code == 422
    assert response.json() == {
        "detail": [
            {
                "type": "additionalProperties",
                "loc": ["body", "config", "jobs", 0, "slots", "core", "tooltip", "subtitel"],
                "msg": "not in the schema (a typo?)",
            }
        ]
    }
    assert client.get("/character-sheet").status_code == 404


def test_put_with_an_unknown_key_keeps_the_saved_config(client, config):
    client.put("/character-sheet", json={"config": config}, headers=ADMIN_HEADERS)
    changed = copy.deepcopy(config)
    changed["titel"] = "Character"

    response = client.put("/character-sheet", json={"config": changed}, headers=ADMIN_HEADERS)

    assert response.status_code == 422
    assert client.get("/character-sheet").json()["config"] == config


@pytest.mark.parametrize(
    "body", [{"config": []}, {"config": "{}"}, {}], ids=["list", "string", "missing"]
)
def test_put_rejects_a_config_that_is_not_an_object(client, body):
    response = client.put("/character-sheet", json=body, headers=ADMIN_HEADERS)

    assert response.status_code == 422


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
