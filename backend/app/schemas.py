from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class ProjectSummary(BaseModel):
    """What the project list endpoint returns — no case_study_md, it's heavy."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    summary: str
    stack: list[str]


class ProjectDetail(ProjectSummary):
    """What a single project page needs — adds the full write-up."""

    case_study_md: str
    repo_url: str | None
    created_at: datetime


class ProjectCreate(BaseModel):
    slug: str
    title: str
    summary: str
    stack: list[str]
    case_study_md: str
    repo_url: str | None = None
    published: bool = False


class ContactCreate(BaseModel):
    name: str
    email: EmailStr
    message: str


class ContactConfirmation(BaseModel):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
