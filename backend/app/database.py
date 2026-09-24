from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

# `connect_args` is SQLite-specific: SQLite defaults to one thread per
# connection, which FastAPI's request handling doesn't respect. Postgres
# doesn't need this arg at all, so we only pass it conditionally.
connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(settings.database_url, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Every model in models.py inherits from this."""

    pass


def get_db():
    """
    A FastAPI dependency, not a plain function. FastAPI calls this per
    request, yields the session to the route handler, and — because this
    is a generator — resumes execution *after* the response is sent to
    run the `finally` block. That's what guarantees the connection is
    always returned to the pool, even if the route handler raises.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
