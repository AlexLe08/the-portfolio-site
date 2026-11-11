from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app.core.config import settings
from app.database import Base
from app import models  # noqa: F401 -- import registers models on Base.metadata

# Alembic's autogenerate compares this metadata against the live database
# to figure out what changed. Without importing app.models, Base.metadata
# would be empty and autogenerate would think every table should be dropped.
target_metadata = Base.metadata

# Use our own Settings (reads DATABASE_URL/.env) instead of the URL baked
# into alembic.ini, so migrations always run against the same database
# the app itself would connect to -- one source of truth, not two.
config.set_main_option("sqlalchemy.url", settings.database_url)


def run_migrations_offline() -> None:
    """Emit SQL without a database connection (alembic --sql)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run against a live connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
