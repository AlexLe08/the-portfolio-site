"""The home page's character sheet config: one JSON document in one row.

The document's shape is owned by the frontend's zod schema
(frontend/components/character-sheet/schema.ts). `npm run
generate:character-schema` exports it as JSON Schema and copies it next to
this file, and tests/test_character_sheet.py fails if the two copies
differ. So the backend enforces the same structure without a second,
hand-written copy of the rules.

What JSON Schema can't express stays on the frontend: zod's trimming, and
checks across fields (duplicate ids, a defaultJobId naming a real job).
The frontend reads the document leniently and falls back to its bundled
config, so a document that passes here but not there costs a job, not the
page.
"""

import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
from pydantic import JsonValue
from sqlalchemy.orm import Session

from app import models

SCHEMA_PATH = Path(__file__).with_name("character_sheet.schema.json")

# The bundled config is about 8 KB. This leaves room for every job to grow
# long page sections while keeping one save from storing megabytes.
MAX_CONFIG_BYTES = 256 * 1024

# A document with hundreds of problems is the wrong document, not one to fix
# line by line; past this many, the rest are left out.
MAX_REPORTED_ERRORS = 50

# The table holds one row (see models.CharacterSheet).
ROW_ID = 1

# No format_checker: "format" (e.g. "uri") is only an annotation in JSON
# Schema 2020-12, and checking "uri" would need an extra package. Rules that
# matter are written as patterns in schema.ts, which are always enforced.
_validator = Draft202012Validator(json.loads(SCHEMA_PATH.read_text(encoding="utf-8")))


@dataclass(frozen=True)
class ConfigIssue:
    """One problem, at a path into the document (keys and list indexes)."""

    path: list[str | int]
    message: str
    kind: str  # the JSON Schema keyword that failed, e.g. "minLength"


class ConfigTooLarge(Exception):
    pass


class InvalidConfig(Exception):
    def __init__(self, issues: list[ConfigIssue]):
        super().__init__(f"{len(issues)} problem(s) in the character sheet config")
        self.issues = issues


def find_issues(config: dict[str, JsonValue]) -> list[ConfigIssue]:
    # In path order, so problems read top to bottom; list indexes compare
    # as numbers (jobs.2 before jobs.10), keys alphabetically.
    errors = sorted(
        _validator.iter_errors(config),
        key=lambda e: [(0, p, "") if isinstance(p, int) else (1, 0, p) for p in e.absolute_path],
    )
    issues = [issue for error in errors for issue in _explain(error)]
    return issues[:MAX_REPORTED_ERRORS]


def _explain(error: ValidationError) -> list[ConfigIssue]:
    """The error itself, or for a failed oneOf, the errors that matter.

    Slot actions are a oneOf with one branch per "kind" (zod's
    discriminatedUnion). jsonschema reports only "is not valid under any of
    the given schemas", and its best_match() can pick the wrong branch: for
    {"kind": "link", "href": "//x"} it blames the anchor branch's missing
    "target". The branch whose "kind" matched is the one with no const
    error, so report that branch's errors instead.
    """
    if error.validator != "oneOf" or not error.context:
        return [_issue(error)]

    branches: dict[int, list[ValidationError]] = defaultdict(list)
    for sub in error.context:
        branches[sub.schema_path[0]].append(sub)
    matched = [subs for subs in branches.values() if not any(s.validator == "const" for s in subs)]
    if len(matched) == 1:
        return [issue for sub in matched[0] for issue in _explain(sub)]

    # No branch matched its discriminator: list what it could have been.
    consts = [sub for sub in error.context if sub.validator == "const"]
    if consts:
        allowed = ", ".join(json.dumps(sub.validator_value) for sub in consts)
        return [_issue(consts[0], f"must be one of {allowed}")]
    return [_issue(error)]


def _issue(error: ValidationError, message: str | None = None) -> ConfigIssue:
    return ConfigIssue(
        path=list(error.absolute_path),
        message=message or error.message,
        kind=str(error.validator),
    )


def get_config(db: Session) -> models.CharacterSheet | None:
    return db.get(models.CharacterSheet, ROW_ID)


def save_config(db: Session, config: dict[str, JsonValue]) -> models.CharacterSheet:
    """Validate the whole document, then insert or replace the one row."""
    if len(json.dumps(config, ensure_ascii=False).encode()) > MAX_CONFIG_BYTES:
        raise ConfigTooLarge
    issues = find_issues(config)
    if issues:
        raise InvalidConfig(issues)

    row = get_config(db)
    if row is None:
        row = models.CharacterSheet(id=ROW_ID, config=config)
        db.add(row)
    else:
        row.config = config
    db.commit()
    db.refresh(row)
    return row
