# Portfolio Frontend

Next.js (App Router) + TypeScript. Talks to the backend via a fully typed
client generated from its OpenAPI schema.

## Setup

```bash
(cd .. && npm install)   # at the repo root: npm workspaces, one lockfile
cp .env.local.example .env.local
```

Requires the backend running at the URL in `.env.local` (defaults to
`http://localhost:8000`) — see `../backend/README.md`.

## Run

```bash
npm run dev
```

http://localhost:3000

## Regenerate the typed API client

Run this any time the backend's routes or Pydantic schemas change:

```bash
../scripts/gen-types.sh
```

It exports `backend/openapi.json` from the app, runs `npm run generate:types`
to rewrite `lib/api-types.ts`, and lists whichever of the two changed.

If a field the frontend expects was removed or renamed on the backend,
this is what makes that show up as a TypeScript error at build time
instead of a runtime bug in front of a visitor.

## Build

```bash
npm run build
```

Pages that fetch backend data are rendered per request, not statically
generated at build time: the home and lab pages read `searchParams`, and
the contact and project pages call `connection()`. This means the build
does NOT require the backend to be reachable.

The backend data itself comes from Next's data cache (`unstable_cache`
in `lib/content.ts`, `lib/character.ts`, `lib/projects.ts`, tagged with
`lib/cache-tags.ts`). A visit gets the last good copy at once and, when
it's over an hour old or an admin save has marked it stale
(`lib/revalidate-public.ts`), refreshes it in the background. A refresh
that fails keeps the old copy, so a sleeping backend doesn't slow pages
down or switch them to built-in text. Only failures are never cached:
with nothing cached yet, an unreachable backend still shows the built-in
fallbacks, as before. Admin pages always read the backend directly.
