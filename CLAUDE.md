# CLAUDE.md

Project instructions for Claude Code. Personal working-style preferences
live in `CLAUDE.local.md` (gitignored). Current status and next steps live
in `docs/roadmap.md`.

## What this is

Personal portfolio and case-study site for Alexander Le, built as a real
product meant to keep growing, not just a portfolio piece.
Live: https://the-portfolio-site-flax.vercel.app
Backend API: https://portfolio-backend-leto.onrender.com (`/health`, `/docs`)

Monorepo:
- `backend/`: FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2. Deployed to
  Render (Docker, free tier). Postgres on Neon in production; SQLite
  locally and in CI.
- `frontend/`: Next.js App Router, React 19, TypeScript. Deployed to
  Vercel (Hobby).
- `docs/`: one runbook per service, plus `roadmap.md`.
- `render.yaml`: Render Blueprint. `docker-compose.yml`: optional local
  Postgres.

## Commands

Backend (run from `backend/`, always via venv binaries; there is no plain
`python` on macOS):
- Setup: `python3 -m venv .venv && ./.venv/bin/pip install -e ".[test]"`
- Migrate: `./.venv/bin/alembic upgrade head`
- Seed (empty database only, fails on duplicate slugs): `./.venv/bin/python seed.py`
- Run: `./.venv/bin/uvicorn app.main:app --reload` (interactive docs at localhost:8000/docs)
- Test: `./.venv/bin/pytest -v`
- New migration after editing `app/models.py`:
  `./.venv/bin/alembic revision --autogenerate -m "describe change"`, then
  read the generated file before upgrading. Autogenerate treats a column
  rename as drop + add, which deletes data.

Frontend (run from `frontend/`; expects the backend at
`NEXT_PUBLIC_API_URL`, default `http://localhost:8000`):
- `npm run dev`, `npm run lint`, `npm run build`
- `npm run test:smoke`: Playwright against production by default
  (`BASE_URL`/`API_URL` override it). Run `npx playwright install chromium`
  once first. See `docs/ci-cd-runbook.md`.
- After any backend route or schema change, regenerate the typed client:
  export `backend/openapi.json` (command in `frontend/README.md`), then
  `npm run generate:types`.

Before opening a PR, run backend `pytest` and frontend `lint` + `build`.
These are exactly what CI runs.

Scripts (`scripts/`, run from anywhere in the checkout). Prefer these to
retyping the commands they wrap; each explains itself in its header:
- `scripts/setup-worktree.sh`: venv, `npm ci`, and `.env` copies from the
  main checkout. Run first in every new worktree.
- `scripts/check.sh [backend|frontend]`: the pre-PR checks above, one line
  per step; full logs in `.logs/`.
- `scripts/gen-types.sh`: export `openapi.json` and regenerate
  `lib/api-types.ts`; prints the files that changed.
- `scripts/local-stack.sh`: backend :8000 + frontend :3000 on a throwaway
  seeded SQLite database, notifications off, prints `ready`. Env vars pass
  through (`CONTACT_RATE_LIMIT=1 scripts/local-stack.sh`).
- `scripts/wait-for-backend.sh [sha]`: after a merge, waits until
  production's backend matches (default: `origin/main`).
- `scripts/cleanup-merged.sh [--apply]`: after a merge, removes local
  branches and worktrees whose remote is gone and that are merged. Dry
  run by default.
- `scripts/new-worktree.sh <branch>`: next task's worktree from
  `origin/main`, with no upstream (so a bare `git push` can't hit `main`),
  then `setup-worktree.sh`.
- `scripts/fake-backend.py [port]`: fake API (`/__mode/ok|500|down`,
  optionally `?path=`) plus a fake Sentry endpoint that logs envelopes,
  for testing outage handling and what gets reported.
- `frontend/demo/stack.mjs`: helpers for PR demo videos (seeded backend,
  production build, stoppable backend, captions, `.webm` in `.logs/`).

## Architecture rules

Backend layering: routers → schemas → models/database. `app/core/`
(config, security, monitoring) is imported by other layers and imports nothing from
them. Imports only point downward.
- `schemas.py` (API contract) stays separate from `models.py` (storage).
  One model can back several schemas; `ProjectSummary` deliberately omits
  `case_study_md`.
- All configuration goes through `Settings` in `app/core/config.py`. Never
  read `os.environ` anywhere else.
- Every schema change goes through an Alembic migration. `create_all` is
  for tests only.
- Tests use an in-memory SQLite database with `StaticPool`, swapped in via
  `app.dependency_overrides[get_db]` (see `tests/conftest.py`). Keep tests
  isolated from each other and from `dev.db`. `conftest.py` also pins
  every setting a developer's `.env` could change (admin key, login,
  notifications); shared helpers live in `tests/helpers.py`, not in
  another test module.
- Every `String(n)` column needs a matching `max_length` on the schemas
  that write it: SQLite ignores the limit, so only Postgres would fail.
- `app/services/` holds logic that isn't HTTP handling (currently
  `notifications.py`: Discord and email; `projects.py`: project queries
  shared by the public and admin routers, including the one list order;
  `media.py`: image upload checks, Cloudinary calls, and the `media` row).
  Routers call services and turn results into HTTP (404, 409); services
  import from `core` but never from routers. Move logic there when a route
  handler starts doing more than HTTP handling plus a simple query.

Frontend:
- Server Components by default. Use `"use client"` only for real
  interactivity (currently `components/ContactForm.tsx`,
  `components/LoginForm.tsx`, `components/ProjectForm.tsx`,
  `components/ContentField.tsx`, `components/MediaUploadForm.tsx`,
  `components/MediaAltTextForm.tsx`, `components/MediaDeleteButton.tsx`,
  `lib/cloudinary-loader.ts` (Next requires it for `images.loaderFile`),
  and the required error boundaries
  `app/error.tsx`, `app/admin/error.tsx`, and `app/global-error.tsx`).
- A new site-content key goes in `FALLBACK_CONTENT` (`lib/content.ts`)
  and in `DESCRIPTIONS` (`app/admin/content/page.tsx`); the build fails
  until both have it. Admin code never reads content through
  `getContent()`, which silently falls back.
- Admin pages (`app/admin/`) and admin Server Actions each call
  `verifySession()` from `lib/session.ts` first, directly or through
  `adminApi()` in `lib/admin-api.ts`, which every admin backend call uses.
  Never rely on a layout for auth, and never send the admin key or the
  session token to the browser. Admin pages read the session cookie,
  which already makes them dynamic, so they don't set `force-dynamic`.
- Pages that fetch backend data set `export const dynamic = "force-dynamic"`,
  because project data can change at any time via the admin API.
- Admin editors use `useSaveAction()` (`lib/use-save-action.ts`) and
  `SaveStatus`, which submit through `onSubmit` so a rejected save keeps
  the edit. Project field rules (slug pattern, max lengths) live in
  `lib/project-rules.ts`, mirroring `schemas.ProjectCreate`.
- Page titles are just the page's own name; `title.template` in
  `app/layout.tsx` and `app/admin/layout.tsx` adds the suffix.
- `lib/api-types.ts` is generated: never hand-edit it. All API calls go
  through the typed client in `lib/api.ts`.

## Hard constraints and known gotchas

- **Free tiers only.** Never configure or suggest anything that adds a
  payment method or a paid feature on Neon, Render, or Vercel. If a
  feature is paid-only, find a free-tier workaround or ask first.
- Render's free tier has no `preDeployCommand` and no shell access.
  Migrations run in the Dockerfile CMD (`alembic upgrade head && uvicorn ...`).
  The CMD must stay in shell form so `${PORT:-8000}` expands.
- The Postgres driver is psycopg v3 (`psycopg[binary]`). SQLAlchemy 2.1+
  maps bare `postgresql://` URLs to it. Use `postgresql+psycopg://` in
  docs and examples, never psycopg2.
- CORS origins come from `ALLOWED_ORIGINS` (comma-separated). Server-side
  fetches aren't affected by CORS; client-side ones (`ContactForm`) are.
  Vercel preview URLs are not allowed origins.
- CI required checks are the job ids `test` (`backend.yml`) and `build`
  (`frontend.yml`). Don't rename them without updating the GitHub ruleset.
  Don't add `paths:` filters to workflow triggers: a required check that
  never runs hangs as "Expected" forever. Don't add a standalone `tsc`
  step, because `next build` type-checks after generating Next's own types.
- `next/font/google` needs network access at build time.
- Dependency ranges are open upward, and changed defaults have already
  broken things twice (Starlette's TestClient moving to `httpx2`,
  SQLAlchemy 2.1 switching drivers). When something breaks after a fresh
  install, check the library's changelog first.

## Design system (`frontend/app/globals.css`)

The visual identity is a technical document. Tokens on `:root`: paper,
ink, muted, rule, signal (blue, the primary accent), and oxide (rust,
reserved for errors and incident callouts only). IBM Plex Sans for all
text; Plex Mono only for literal technical identifiers (stack tags,
title-block labels).

Avoid: uppercase or letter-spaced eyebrow labels, arrow-suffixed links,
middot-joined lists, rounded-and-shadowed cards, gradients, and new accent
colors. Keep visible `:focus-visible` rings on everything interactive.

## Workflow

- `main` is protected: branch, PR, CI green, merge. Merging to `main`
  auto-deploys both services.
- Never commit secrets. `.env` and `.env.local` are gitignored; variable
  names are documented in the `.env.example` files and
  `docs/render-runbook.md`.
- Runbooks: `docs/neon-runbook.md`, `docs/render-runbook.md`,
  `docs/vercel-runbook.md`, `docs/ci-cd-runbook.md`. Read the relevant one
  before changing deployment, CI, or database setup, and update it when
  that setup changes.
