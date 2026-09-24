from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.security import require_admin_key
from app.database import get_db

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[schemas.ProjectSummary])
def list_projects(db: Session = Depends(get_db)):
    stmt = select(models.Project).where(models.Project.published.is_(True))
    return db.scalars(stmt).all()


@router.get("/{slug}", response_model=schemas.ProjectDetail)
def get_project(slug: str, db: Session = Depends(get_db)):
    project = db.scalar(
        select(models.Project).where(models.Project.slug == slug)
    )
    if project is None or not project.published:
        raise HTTPException(404, "Project not found")
    return project


@router.post(
    "",
    response_model=schemas.ProjectDetail,
    status_code=201,
    dependencies=[Depends(require_admin_key)],
)
def create_project(payload: schemas.ProjectCreate, db: Session = Depends(get_db)):
    existing = db.scalar(
        select(models.Project).where(models.Project.slug == payload.slug)
    )
    if existing is not None:
        raise HTTPException(409, f"Project with slug '{payload.slug}' already exists")

    project = models.Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
