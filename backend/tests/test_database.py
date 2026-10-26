from sqlalchemy import text

from app.database import make_engine


def test_dead_pooled_connection_is_replaced(tmp_path):
    """
    What Neon does when it scales to zero: a connection waiting in the pool
    gets closed underneath it. The next request must still get a working
    connection (pool_pre_ping), not the dead one. A file database, not the
    shared in-memory one: StaticPool has a single connection and no pool to
    check.
    """
    engine = make_engine(f"sqlite:///{tmp_path / 'pool.db'}")
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            idle = conn.connection.dbapi_connection
        # Back in the pool now, the way it waits between requests.
        idle.close()

        with engine.connect() as conn:
            assert conn.execute(text("SELECT 1")).scalar() == 1
    finally:
        engine.dispose()
