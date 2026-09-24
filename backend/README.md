# Portfolio Backend

FastAPI + SQLAlchemy + Alembic. Defaults to SQLite locally, Postgres in production.

## Setup

```bash
python3 -m venv .venv
./.venv/bin/pip install -e ".[test]"
cp .env.example .env
./.venv/bin/alembic upgrade head
```

## Run

```bash
./.venv/bin/uvicorn app.main:app --reload
```

Interactive API docs (auto-generated from the Pydantic schemas): http://localhost:8000/docs

## Test

```bash
./.venv/bin/pytest -v
```

## Schema changes

After editing `app/models.py`:

```bash
./.venv/bin/alembic revision --autogenerate -m "describe the change"
./.venv/bin/alembic upgrade head
```

Always read the generated migration file before running it — autogenerate
is a diffing tool, not a guarantee of correctness (it can't detect a
column rename, for example; it'll see that as a drop + an add).

## Develop against Postgres instead of SQLite

```bash
docker compose up -d          # from the repo root
export DATABASE_URL=postgresql+psycopg2://postgres:devpassword@localhost:5432/portfolio
./.venv/bin/alembic upgrade head
```
