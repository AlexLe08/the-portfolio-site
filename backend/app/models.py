from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    stack: Mapped[list[str]] = mapped_column(JSON, default=list)
    case_study_md: Mapped[str] = mapped_column(Text)
    repo_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
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

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
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
    alt_text: Mapped[str] = mapped_column(String(300))
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
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
