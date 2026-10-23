#!/usr/bin/env bash
# Regenerates the frontend's typed API client after a backend route or
# schema change: exports backend/openapi.json, then runs
# `npm run generate:types` to rewrite frontend/lib/api-types.ts. Ends with
# `git status` for the two files, so an unchanged API shows nothing.
#
# Usage: scripts/gen-types.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

(cd "$root/backend" && ./.venv/bin/python -c "
import json
from app.main import app
with open('openapi.json', 'w') as f:
    json.dump(app.openapi(), f, indent=2)
")
(cd "$root/frontend" && npm run --silent generate:types >/dev/null)

git -C "$root" status --short -- backend/openapi.json frontend/lib/api-types.ts
