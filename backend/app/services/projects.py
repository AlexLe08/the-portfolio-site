"""Project queries shared by the public and admin routers.

Routers decide what a missing or unpublished project means over HTTP;
this module only finds them, so the public list and the admin list can't
drift apart on ordering.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models


def list_projects(db: Session, *, include_drafts: bool) -> list[models.Project]:
    # Without ORDER BY, Postgres returns rows in whatever order it finds them,
    # and an UPDATE can move a row. id breaks ties so the order is stable.
    stmt = select(models.Project).order_by(models.Project.sort_order, models.Project.id)
    if not include_drafts:
        stmt = stmt.where(models.Project.published.is_(True))
    return list(db.scalars(stmt))


def find_project(db: Session, slug: str) -> models.Project | None:
    """Find a project by slug, drafts included."""
    return db.scalar(select(models.Project).where(models.Project.slug == slug))
