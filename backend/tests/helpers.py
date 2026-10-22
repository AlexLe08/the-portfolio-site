"""Helpers shared by several test modules.

conftest.py pins settings.admin_api_key to this value, so these headers
match whatever a developer's .env sets ADMIN_API_KEY to.
"""

from app import models

ADMIN_KEY = "test-admin-key"
ADMIN_HEADERS = {"x-admin-key": ADMIN_KEY}


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
