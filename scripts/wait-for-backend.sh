#!/usr/bin/env bash
# Waits until the deployed backend runs the same backend/ code as a commit.
# Render only deploys when a commit touches backend/ (its rootDir), so
# /health's `commit` can legitimately stay on an older commit; the backend
# is current once that commit's backend/ matches. Polls every 15 seconds,
# WAIT_ATTEMPTS times (default 40, about 10 minutes). Used by smoke.yml.
#
# Usage: scripts/wait-for-backend.sh [sha] [api_url]
#   sha      default: origin/main, fetched first (i.e. "the merge just landed")
#   api_url  default: production
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ $# -ge 1 ]]; then
  sha="$1"
else
  git fetch -q origin main
  sha="$(git rev-parse origin/main)"
fi
api_url="${2:-https://portfolio-backend-leto.onrender.com}"

for _ in $(seq 1 "${WAIT_ATTEMPTS:-40}"); do
  deployed="$(curl -s --max-time 60 "$api_url/health" | jq -r '.commit // empty' || true)"
  if [[ -n "$deployed" ]] && git cat-file -e "$deployed^{commit}" 2>/dev/null \
    && git diff --quiet "$deployed" "$sha" -- backend; then
    echo "Backend at $deployed serves the same backend/ as $sha"
    exit 0
  fi
  echo "Backend at ${deployed:-unknown}, waiting for $sha"
  sleep 15
done
echo "Backend never caught up with $sha" >&2
exit 1
