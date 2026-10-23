#!/usr/bin/env bash
# The checks CI runs before a PR can merge: backend pytest (job `test`),
# frontend lint + build (job `build`). Prints one line per step; the full
# output of each goes to .logs/<step>.log, and a failing step also prints
# its last 30 lines.
#
# Usage: scripts/check.sh [backend|frontend]   (default: both)
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
logs="$root/.logs"
mkdir -p "$logs"
target="${1:-all}"
failed=0

# run <name> <dir> <command...>
run() {
  local name=$1 dir=$2
  shift 2
  local log="$logs/$name.log"
  if (cd "$root/$dir" && "$@") >"$log" 2>&1; then
    # pytest's last line is its summary ("111 passed in 0.9s").
    if [[ "$name" == pytest ]]; then echo "pass  $name  $(tail -n 1 "$log")"; else echo "pass  $name"; fi
  else
    echo "FAIL  $name  (full log: .logs/$name.log)"
    tail -n 30 "$log"
    failed=1
  fi
}

if [[ "$target" == all || "$target" == backend ]]; then
  run pytest backend ./.venv/bin/pytest -q
fi
if [[ "$target" == all || "$target" == frontend ]]; then
  run lint frontend npm run lint
  run build frontend npm run build
fi

exit "$failed"
