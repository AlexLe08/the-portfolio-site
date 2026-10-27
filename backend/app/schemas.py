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


class ProjectAdmin(ProjectDetail):
    """What the admin editor needs: everything, including drafts' state.
    Only returned from admin routes; the public schemas above stay lean."""

    published: bool
    sort_order: int


# Lowercase words joined by single hyphens, e.g. "portfolio-site". The
# slug is the project's URL and can't change after creation (see
# ProjectUpdate), so a malformed one would be stuck there for good.
# Same rule as the admin form's pattern attribute (ProjectForm.tsx).
SLUG_PATTERN = r"^[a-z0-9]+(-[a-z0-9]+)*$"


class ProjectCreate(BaseModel):
    # Each max_length matches its String(n) column in models.py. Postgres
    # enforces those limits but SQLite doesn't, so without them tests pass
    # and prod 500s.
    slug: str = Field(max_length=120, pattern=SLUG_PATTERN)
    title: str = Field(max_length=200)
    summary: str
    stack: list[str]
    case_study_md: str
    repo_url: str | None = Field(default=None, max_length=300)
    published: bool = False
    sort_order: int = 0


class ProjectUpdate(BaseModel):
    """A partial update: only the fields present in the request body change.

    No slug: it's the project's URL, and changing it would break links
    people have already shared. extra="forbid" makes sending one a 422
    instead of a silent no-op.
    """

    model_config = ConfigDict(extra="forbid")

    # Same limits as ProjectCreate.
    title: str | None = Field(default=None, max_length=200)
    summary: str | None = None
    stack: list[str] | None = None
    case_study_md: str | None = None
    repo_url: str | None = Field(default=None, max_length=300)
    published: bool | None = None
    sort_order: int | None = None

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


class AdminLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Capped because argon2 hashes whatever it's given: an unbounded field
    # would let one request burn CPU on a multi-megabyte "password".
    password: str = Field(min_length=1, max_length=256)


class AdminToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime


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


class MediaCreate(BaseModel):
    """The form fields sent alongside the file in POST /media."""

    # Whitespace is stripped first, so "   " fails min_length instead of
    # passing as alt text a screen reader would read as nothing. No
    # extra="forbid": FastAPI validates this model against the whole form,
    # and the file part would count as an extra field.
    model_config = ConfigDict(str_strip_whitespace=True)

    alt_text: str = Field(min_length=1, max_length=300)


class MediaUpdate(BaseModel):
    """PATCH /media/{id}. Only the alt text can change: the file itself is
    replaced by uploading a new one, and the public_id stays as uploaded
    because renaming it would change the URL pasted into content.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    # Same limit as MediaCreate and the String(300) column.
    alt_text: str = Field(min_length=1, max_length=300)


class MediaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    alt_text: str
    width: int
    height: int
    content_type: str
    size_bytes: int
    created_at: datetime
