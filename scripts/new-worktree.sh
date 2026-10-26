#!/usr/bin/env bash
# Starts the next task: a new branch from the latest origin/main, in its
# own worktree under .claude/worktrees/ (named after the branch, `/`
# becoming `-`), set up by scripts/setup-worktree.sh.
#
# The branch gets no upstream (--no-track). Branched from origin/main, git
# would otherwise track main, and a bare `git push` would push to it. The
# first push sets the right one: git push -u origin <branch>.
#
# Usage: scripts/new-worktree.sh <branch>   e.g. feat/media-library
set -euo pipefail

branch="${1:?usage: scripts/new-worktree.sh <branch>}"
root="$(cd "$(dirname "$0")/.." && pwd)"
# The first entry of `git worktree list` is always the main checkout.
main_checkout="$(git -C "$root" worktree list --porcelain | head -n 1 | sed 's/^worktree //')"
dir="$main_checkout/.claude/worktrees/${branch//\//-}"

git -C "$root" fetch -q origin main
git -C "$root" worktree add --no-track -b "$branch" "$dir" origin/main
"$dir/scripts/setup-worktree.sh"
echo "worktree ready: $dir"
