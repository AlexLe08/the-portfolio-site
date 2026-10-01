# Portfolio Site

A full-stack portfolio and case-study site. FastAPI backend, Next.js
frontend, deployed as two independently-hosted services sharing one repo.

**Live site**: https://the-portfolio-site-flax.vercel.app

## Architecture

``` frontend/ Next.js (App Router) + TypeScript, deployed on Vercel
``` backend/ FastAPI + SQLAlchemy + Alembic, deployed on Render (Docker)
``` Postgres hosted on Neon (production) / SQLite (local dev)

The frontend talks to the backend through a TypeScript client generated
directly from the backend's OpenAPI schema (`frontend/lib/api-types.ts`) —
a backend field rename shows up as a frontend type error, not a runtime
bug. See `frontend/README.md`'s "Regenerate the typed API client" section.

## Getting started locally

1. Backend: `backend/README.md`
2. Frontend: `frontend/README.md` (needs the backend running first)

Both default to zero-config local setup — SQLite for the database, no
external accounts needed to develop.

## Deployment

Three external services, each documented with the actual setup steps and
the free-tier-specific issues hit along the way:

- [`docs/neon-runbook.md`](docs/neon-runbook.md) — Postgres (production database)
- [`docs/render-runbook.md`](docs/render-runbook.md) — backend hosting
- [`docs/vercel-runbook.md`](docs/vercel-runbook.md) — frontend hosting
- [`docs/ci-cd-runbook.md`](docs/ci-cd-runbook.md) — GitHub Actions and branch protection

All three hosting services were chosen specifically for having a free tier
with no mechanism to silently start billing — no payment method is on file
anywhere in this stack.

## CI/CD

Every PR runs two required checks (`backend.yml`, `frontend.yml`) before
`main` can be merged into, enforced by a GitHub branch ruleset. Merging to
`main` auto-deploys both services. Details in
[`docs/ci-cd-runbook.md`](docs/ci-cd-runbook.md).

## Why a monorepo

Frontend and backend changes that touch both sides of the typed API
contract land as one PR and one commit, instead of two repos that have to
be coordinated manually. Each service still deploys independently —
Vercel and Render both build from their own subdirectory
(`rootDir`/"Root Directory" in each platform's config) and ignore changes
to the other half of the repo.