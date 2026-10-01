# Neon (Postgres)

Neon hosts the production Postgres database. Local development uses SQLite
by default and never needs Neon — see `backend/README.md`.

## Why Neon, specifically

A hard requirement for this project was a database that **cannot** silently
start billing. Neon's free tier is usage-capped, not usage-billed: when a
project exceeds its monthly allowance, Neon suspends the database's compute
until the next cycle rather than charging an overage. No card is required
to sign up at all, so there's no payment method on file to charge even if
that weren't true.

Free tier limits (confirm current values at neon.tech/pricing, these can
change): 100 compute-hours/month, 0.5 GB storage, 10 branches.

## Creating the project

When creating a new project, Neon offers several toggles beyond the base
Postgres database: **Object storage**, **Functions**, **AI Gateway**, and
**Neon Auth**. None of these are needed:

- **Object storage** — no file uploads in this project; case studies are
  stored as markdown text in the `projects.case_study_md` column.
- **Functions** — would run Node.js compute inside Neon, duplicating the
  FastAPI backend already running on Render.
- **Neon Auth** — provisions its own `neon_auth` schema that Alembic
  doesn't know about. Admin auth here is a single shared key
  (`require_admin_key` in `app/core/security.py`), which is enough for a
  site with one admin.
- **AI Gateway** — required a paid plan as of initial setup; irrelevant to
  this project regardless.

Leave all four off. Only **Postgres database** should be enabled.

**Region**: chosen to match Render's region (Oregon / AWS us-west-2) to
keep the backend-to-database hop low-latency. Not critical at this scale,
but free to get right at creation time — unlike Render, Neon's project
region can't be changed later without creating a new project.

## Getting the connection string

Dashboard → your project → **Connect** button. Copy the full string as
given; it already includes `sslmode=require`, which Postgres needs over
the public internet.

**Known gotcha**: Neon's connection string uses the plain `postgresql://`
scheme. SQLAlchemy 2.1+ changed its default driver for that scheme from
`psycopg2` to `psycopg` (v3) — a project using the older `psycopg2-binary`
dependency will fail at startup with `ModuleNotFoundError: No module named
'psycopg'`. This project uses `psycopg[binary]` (v3) specifically to match
Neon's connection string as given — see `backend/pyproject.toml`. If this
error reappears, it means a dependency regressed back to expecting
psycopg2.

## Where the connection string is used

Pasted once, directly into Render's dashboard as the `DATABASE_URL`
environment variable (see `render.yaml` / `docs/render-runbook.md`). Never
committed to the repo. For local development against a real Postgres
instance instead of SQLite, see the "Develop against Postgres" section of
`backend/README.md` (uses a local Docker Postgres, not Neon).

## Running migrations and seeding

Render's free tier has no shell access, so both of these are run from a
local machine, pointed at the Neon database via an inline env var:

```bash
cd backend
DATABASE_URL="<neon connection string>" ./.venv/bin/alembic upgrade head
DATABASE_URL="<neon connection string>" ./.venv/bin/python seed.py
```

In practice, the first migration against Neon happens automatically on
every Render deploy (see `docs/render-runbook.md` — migrations run as part of the
container's startup command). Seeding is the one step that has to be run
manually, since it's a one-time data load, not a schema change.