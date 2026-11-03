"""Path lookups shared by routers: a route that declares
`project: models.Project = Depends(existing_project)` gets the row or a 404.

FastAPI caches get_db per request, so the route's own `db` is the same
session that loaded the row, and changes to it commit normally.
"""

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.services import media, projects


def existing_project(slug: str, db: Session = Depends(get_db)) -> models.Project:
    """Drafts included: the admin editor reads them, and publishing is a PATCH."""
    project = projects.find_project(db, slug)
    if project is None:
        raise HTTPException(404, "Project not found")
    return project


def existing_media(media_id: int, db: Session = Depends(get_db)) -> models.Media:
    item = media.find_media(db, media_id)
    if item is None:
        raise HTTPException(404, "Media not found")
    return item
