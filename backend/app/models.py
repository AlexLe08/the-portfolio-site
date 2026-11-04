from datetime import datetime

from pydantic import JsonValue
from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Column sizes the schemas also use as max_length. SQLite ignores String(n),
# so without a matching max_length only Postgres would reject a long value.
SLUG_LENGTH = 120
TITLE_LENGTH = 200
REPO_URL_LENGTH = 300
CONTENT_KEY_LENGTH = 100
ALT_TEXT_LENGTH = 300
CONTACT_NAME_LENGTH = 200

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(SLUG_LENGTH), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(TITLE_LENGTH))
    summary: Mapped[str] = mapped_column(Text)
    stack: Mapped[list[str]] = mapped_column(JSON, default=list)
    case_study_md: Mapped[str] = mapped_column(Text)
    repo_url: Mapped[str | None] = mapped_column(String(REPO_URL_LENGTH), nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    # Position in the project list, lowest first. server_default lets the
    # migration add this NOT NULL column to rows that already exist.
    sort_order: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SiteContent(Base):
    """Site copy (intro text, facts, page blurbs), keyed like "home.intro".

    The key is the primary key: there's exactly one value per key, and the
    frontend only ever looks values up by key.
    """

    __tablename__ = "site_content"

    key: Mapped[str] = mapped_column(String(CONTENT_KEY_LENGTH), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CharacterSheet(Base):
    """The home page's character sheet config, edited as one JSON document.

    A single row (the check constraint keeps it that way): the frontend
    loads the whole document at once and falls back to its bundled copy
    while no row exists. JSON rather than Postgres's JSONB, because JSON
    keeps the document's key order, which matters when editing it raw.
    """

    __tablename__ = "character_sheet"
    __table_args__ = (CheckConstraint("id = 1", name="character_sheet_single_row"),)

    # Always 1, never generated, so Postgres creates no id sequence.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    # Typed as "a JSON object", not the config's exact shape: the backend
    # never reads inside it, and the shape is owned by the frontend's zod
    # schema (enforced here through the JSON Schema generated from it).
    config: Mapped[dict[str, JsonValue]] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Media(Base):
    """An uploaded image. The file itself lives on Cloudinary; this row is
    what the site needs to render it.

    public_id is Cloudinary's name for the file, kept so it can be deleted
    or replaced there, and so a later provider move only rewrites public_id
    and url. Images only for now, so width and height are always known
    (next/image needs both for remote images).
    """

    __tablename__ = "media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    url: Mapped[str] = mapped_column(String(500))
    public_id: Mapped[str] = mapped_column(String(255), unique=True)
    alt_text: Mapped[str] = mapped_column(String(ALT_TEXT_LENGTH))
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(CONTACT_NAME_LENGTH))
    email: Mapped[str] = mapped_column(String(320))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
