from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.core.security import require_admin
from app.database import get_db
from app.services import media, projects

# Admin-only reads for the admin UI. The dependency sits on the router, so
# every route added here is protected without having to remember it.
# Writes stay on the resource routers (POST/PATCH /projects, PUT /content),
# which already require admin auth.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/projects", response_model=list[schemas.ProjectAdmin])
def list_all_projects(db: Session = Depends(get_db)):
    # Same order as the public list, drafts included, so the editor shows
    # exactly where a draft will appear once it's published.
    return projects.list_projects(db, include_drafts=True)


@router.get("/projects/{slug}", response_model=schemas.ProjectAdmin)
def get_any_project(slug: str, db: Session = Depends(get_db)):
    project = projects.find_project(db, slug)
    if project is None:
        raise HTTPException(404, "Project not found")
    return project


@router.get("/media", response_model=list[schemas.MediaRead])
def list_media(db: Session = Depends(get_db)):
    return media.list_media(db)
