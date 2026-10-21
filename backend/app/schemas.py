from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


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


class ProjectUpdate(BaseModel):
    """A partial update: only the fields present in the request body change.

    No slug: it's the project's URL, and changing it would break links
    people have already shared. extra="forbid" makes sending one a 422
    instead of a silent no-op.
    """

    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    summary: str | None = None
    stack: list[str] | None = None
    case_study_md: str | None = None
    repo_url: str | None = None
    published: bool | None = None

    @model_validator(mode="after")
    def reject_null_for_required_fields(self) -> "ProjectUpdate":
        # None is the default for "not sent", so it has to be allowed in the
        # types above. Sent explicitly, it only makes sense for repo_url, the
        # one nullable column; anywhere else it would fail at the database.
        nulls = sorted(
            name
            for name in self.model_fields_set
            if name != "repo_url" and getattr(self, name) is None
        )
        if nulls:
            raise ValueError(f"cannot be null: {', '.join(nulls)}")
        return self


# Lowercase dotted segments, e.g. "home.intro" or "home.fact.location".
# Strict on purpose: PUT creates keys that don't exist yet, so a loose
# pattern would let typos like "Home Intro " pile up as orphan rows.
CONTENT_KEY_PATTERN = r"^[a-z0-9_]+(\.[a-z0-9_]+)*$"


class ContentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: str


class ContentEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: str
    updated_at: datetime


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    # Capped below Discord's 4096-character embed description limit so the
    # whole message fits in one webhook notification (see services/notifications.py).
    message: str = Field(min_length=1, max_length=4000)
    # Honeypot: the form renders this field hidden, so people never fill it
    # but form-filling bots do. Not stored (see routers/contact.py). No length
    # limit on purpose: a 422 would tell a bot it was caught.
    website: str = ""


class ContactConfirmation(BaseModel):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
