from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.security import require_admin
from app.database import get_db
from app.services import projects

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[schemas.ProjectSummary])
def list_projects(db: Session = Depends(get_db)):
    return projects.list_projects(db, include_drafts=False)


@router.get("/{slug}", response_model=schemas.ProjectDetail)
def get_project(slug: str, db: Session = Depends(get_db)):
    project = projects.find_project(db, slug)
    if project is None or not project.published:
        raise HTTPException(404, "Project not found")
    return project


@router.post(
    "",
    response_model=schemas.ProjectDetail,
    status_code=201,
    dependencies=[Depends(require_admin)],
)
def create_project(payload: schemas.ProjectCreate, db: Session = Depends(get_db)):
    if projects.find_project(db, payload.slug) is not None:
        raise HTTPException(409, f"Project with slug '{payload.slug}' already exists")

    project = models.Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.patch(
    "/{slug}",
    response_model=schemas.ProjectDetail,
    dependencies=[Depends(require_admin)],
)
def update_project(slug: str, payload: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    # Unlike the public GET, drafts are found too: publishing one is an update.
    project = projects.find_project(db, slug)
    if project is None:
        raise HTTPException(404, "Project not found")

    # exclude_unset: only fields the client actually sent, so omitting a
    # field leaves it alone while sending "repo_url": null clears it.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project
