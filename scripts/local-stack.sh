#!/usr/bin/env bash
# Runs the whole site locally against a throwaway, seeded SQLite database:
# backend on :8000, frontend (next dev) on :3000. Prints "ready" once both
# answer, then runs until Ctrl-C, which stops both. Logs go to
# .logs/local-backend.log and .logs/local-frontend.log.
#
# Always isolated from production, whatever .env says: shell variables
# override .env files (pydantic-settings and Next.js both), so the database
# is a temp file, notifications are off, and the frontend calls the local
# backend. Other settings pass through, e.g.
#   CONTACT_RATE_LIMIT=1 CONTACT_RATE_WINDOW_SECONDS=600 scripts/local-stack.sh
# Smoke tests against it, from frontend/:
#   BASE_URL=http://localhost:3000 API_URL=http://localhost:8000 npm run test:smoke
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
logs="$root/.logs"
mkdir -p "$logs"

for port in 8000 3000; do
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "port $port is already in use; stop that server first" >&2
    exit 1
  fi
done

db_dir="$(mktemp -d)"
export DATABASE_URL="sqlite:///$db_dir/local.db"
export ALLOWED_ORIGINS="http://localhost:3000"
export DISCORD_WEBHOOK_URL="" RESEND_API_KEY="" NOTIFY_EMAIL_TO="" CLIENT_IP_HEADER=""
export NEXT_PUBLIC_API_URL="http://localhost:8000"

backend_pid="" frontend_pid=""
cleanup() {
  # Both ports were free at start, so whatever listens on them now is ours
  # (this also catches next dev's server, a grandchild of npm).
  # shellcheck disable=SC2086 # word splitting is intended: a list of pids
  kill $backend_pid $frontend_pid $(lsof -t -iTCP:8000 -iTCP:3000 -sTCP:LISTEN 2>/dev/null) 2>/dev/null || true
  rm -rf "$db_dir"
}
trap cleanup EXIT INT TERM

cd "$root/backend"
./.venv/bin/alembic upgrade head >"$logs/local-backend.log" 2>&1
./.venv/bin/python seed.py >>"$logs/local-backend.log" 2>&1
./.venv/bin/uvicorn app.main:app --port 8000 >>"$logs/local-backend.log" 2>&1 &
backend_pid=$!

cd "$root/frontend"
npm run dev -- --port 3000 >"$logs/local-frontend.log" 2>&1 &
frontend_pid=$!

for _ in $(seq 1 60); do
  if curl -sf http://localhost:8000/health >/dev/null && curl -sf -o /dev/null http://localhost:3000/; then
    echo "ready  backend http://localhost:8000  frontend http://localhost:3000"
    wait
    exit 0
  fi
  sleep 2
done
echo "not ready after 2 minutes; see .logs/local-backend.log and .logs/local-frontend.log" >&2
exit 1
