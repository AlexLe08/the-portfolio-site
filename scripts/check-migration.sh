#!/usr/bin/env bash
# Checks the Alembic migrations on both engines the backend runs on: a
# throwaway Postgres (production is Postgres on Neon; CI only runs SQLite)
# and a throwaway SQLite file. On each: upgrade to head, downgrade one
# step, upgrade again, then `alembic check` (the models and migrations
# agree). Then prints the Postgres definition of each table named, or the
# list of tables and sequences, since some differences only show there
# (an integer primary key gets a sequence, JSON vs JSONB). Prints one line
# per step; the full output goes to .logs/migration.log.
#
# Never touches dev.db, the docker compose database or its volume, or
# Neon: DATABASE_URL is set explicitly for every command, and the
# container has no volume and is removed on exit. Needs Docker running.
#
# Usage: scripts/check-migration.sh [table ...]
#   PG_PORT (default 55432) and PG_IMAGE (default postgres:16, as in
#   docker-compose.yml) can be overridden.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
logs="$root/.logs"
mkdir -p "$logs"
log="$logs/migration.log"
: >"$log"

port="${PG_PORT:-55432}"
image="${PG_IMAGE:-postgres:16}"
container="check-migration-$$"
sqlite_dir="$(mktemp -d)"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$sqlite_dir"
}
trap cleanup EXIT

if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running; start Docker Desktop first" >&2
  exit 1
fi
if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $port is already in use; set PG_PORT to a free one" >&2
  exit 1
fi

# step <name> <database url> <alembic args...>
step() {
  local name=$1 url=$2
  shift 2
  echo "== $name: alembic $*" >>"$log"
  if (cd "$root/backend" && DATABASE_URL="$url" ./.venv/bin/alembic "$@") >>"$log" 2>&1; then
    echo "pass  $name  alembic $*"
  else
    echo "FAIL  $name  alembic $*  (full log: .logs/migration.log)"
    tail -n 30 "$log"
    exit 1
  fi
}

# round_trip <name> <database url>
round_trip() {
  step "$1" "$2" upgrade head
  step "$1" "$2" downgrade -1
  step "$1" "$2" upgrade head
  step "$1" "$2" check
}

docker run -d --name "$container" -e POSTGRES_PASSWORD=check -e POSTGRES_DB=portfolio \
  -p "$port:5432" "$image" >>"$log" 2>&1
# The image's first start runs a temporary server to initialize the
# database, then restarts; pg_isready can answer during that first one.
# The init log line marks the real start.
for _ in $(seq 1 60); do
  if docker logs "$container" 2>&1 | grep -q "PostgreSQL init process complete" &&
    docker exec "$container" pg_isready -q -U postgres -d portfolio; then
    break
  fi
  sleep 1
done
docker exec "$container" pg_isready -q -U postgres -d portfolio || {
  echo "Postgres didn't start; see: docker logs $container" >&2
  exit 1
}

round_trip postgres "postgresql+psycopg://postgres:check@localhost:$port/portfolio"
round_trip sqlite "sqlite:///$sqlite_dir/check.db"

echo
if [[ $# -gt 0 ]]; then
  for table in "$@"; do
    docker exec "$container" psql -U postgres -d portfolio -c "\\d $table"
  done
else
  docker exec "$container" psql -U postgres -d portfolio -c '\dt' -c '\ds'
fi
