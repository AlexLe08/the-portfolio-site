from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


def make_engine(url: str) -> Engine:
    """
    A function, not inline, so tests/test_database.py can check these
    settings on an engine of its own.

    pool_pre_ping: the pool keeps connections open between requests, and
    Neon's free plan scales the database to zero after 5 idle minutes
    (fixed), closing them. Without a check, the first request after a quiet
    spell got a dead connection and failed with a 500 ("SSL connection has
    been closed unexpectedly"). Pre-ping runs a tiny query when a request
    takes a connection and swaps in a fresh one if it's dead, at the cost
    of one round trip per request.

    `connect_args` is SQLite-specific: SQLite defaults to one thread per
    connection, which FastAPI's request handling doesn't respect. Postgres
    doesn't need this arg at all, so we only pass it conditionally.
    """
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


engine = make_engine(settings.database_url)

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
