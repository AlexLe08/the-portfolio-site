"""Helpers shared by several test modules.

conftest.py pins settings.admin_api_key to this value, so these headers
match whatever a developer's .env sets ADMIN_API_KEY to.
"""

from argon2 import PasswordHasher

from app import models

ADMIN_KEY = "test-admin-key"
ADMIN_HEADERS = {"x-admin-key": ADMIN_KEY}

PASSWORD = "correct horse battery staple"
# Minimum argon2 cost so each verify is fast; the parameters are stored in
# the hash itself, so the app's default PasswordHasher still checks it.
PASSWORD_HASH = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1).hash(PASSWORD)


def contact_payload(**overrides):
    """A valid POST /contact body."""
    return {"name": "Jamie", "email": "jamie@example.com", "message": "Hi there", **overrides}


def project_payload(**overrides):
    """A valid POST /projects body."""
    return {
        "slug": "new-project",
        "title": "New",
        "summary": "S",
        "stack": [],
        "case_study_md": "x",
        **overrides,
    }


def make_project(db_session, **overrides):
    defaults = dict(
        slug="test-project",
        title="Test Project",
        summary="A project for testing.",
        stack=["Python"],
        case_study_md="# Test",
        published=True,
    )
    project = models.Project(**{**defaults, **overrides})
    db_session.add(project)
    db_session.commit()
    return project
