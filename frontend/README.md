# Portfolio Frontend

Next.js (App Router) + TypeScript. Talks to the backend via a fully typed
client generated from its OpenAPI schema.

## Setup

```bash
npm install
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
cd ../backend
./.venv/bin/python -c "
import json
from app.main import app
with open('openapi.json', 'w') as f:
    json.dump(app.openapi(), f, indent=2)
"
cd ../frontend
npm run generate:types
```

If a field the frontend expects was removed or renamed on the backend,
this is what makes that show up as a TypeScript error at build time
instead of a runtime bug in front of a visitor.

## Build

```bash
npm run build
```

Pages that fetch backend data are rendered per-request
(`export const dynamic = "force-dynamic"`), not statically generated at
build time — project data can change at any time via the backend's admin
API, so a build-time snapshot would go stale. This means the build does
NOT require the backend to be reachable.
