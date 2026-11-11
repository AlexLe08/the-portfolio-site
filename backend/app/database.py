from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def make_engine(url: str) -> Engine:
    """A function so tests/test_database.py can build an engine of its own.

    pool_pre_ping: Neon's free plan scales to zero after 5 idle minutes and
    closes pooled connections, so the first request after a quiet spell got
    a dead one and a 500. Pre-ping swaps in a fresh connection, at one round
    trip per request.

    check_same_thread (SQLite only): FastAPI runs requests on several
    threads, which SQLite refuses by default.
    """
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


engine = make_engine(settings.database_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """One session per request. The `finally` runs after the response, so
    the connection goes back to the pool even when the route raises."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
