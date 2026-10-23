#!/usr/bin/env bash
# Prepares a fresh checkout (usually a git worktree under .claude/worktrees/)
# to run: backend venv with test extras, frontend node_modules, and copies of
# the gitignored env files from the main checkout. Safe to re-run: existing
# venvs and env files are kept.
#
# Usage: scripts/setup-worktree.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
# The first entry of `git worktree list` is always the main checkout.
main="$(git -C "$root" worktree list --porcelain | head -n 1 | sed 's/^worktree //')"

if [[ ! -x "$root/backend/.venv/bin/python" ]]; then
  echo "backend: creating .venv"
  python3 -m venv "$root/backend/.venv"
fi
echo "backend: installing dependencies"
(cd "$root/backend" && PIP_DISABLE_PIP_VERSION_CHECK=1 ./.venv/bin/pip install -q -e ".[test]")

echo "frontend: npm ci"
(cd "$root/frontend" && npm ci --silent --no-audit --no-fund)

# Each worktree needs its own copies: .env files are gitignored.
if [[ "$main" != "$root" ]]; then
  for file in backend/.env frontend/.env.local; do
    if [[ -f "$main/$file" && ! -f "$root/$file" ]]; then
      cp "$main/$file" "$root/$file"
      echo "copied $file from the main checkout"
    fi
  done
fi

echo "ready"
