#!/usr/bin/env bash
# After a PR merges: lists the local branches and worktrees it left behind,
# and with --apply removes them. A branch qualifies only when its upstream
# is gone (GitHub deletes the remote branch on merge) AND it is merged into
# origin/main. "Merged" alone isn't enough: a new branch with no commits
# yet counts as merged too.
#
# Deletes only safely: `git worktree remove` without --force (refuses
# uncommitted or untracked files; ignored ones like .venv and .logs go with
# the worktree) and `git branch -d` (refuses unmerged commits). Never
# touches main, the main checkout, or the worktree it runs from; to clean
# up the current one, run scripts/new-worktree.sh and rerun from there.
# Detects merge commits, which is how PRs merge here; a squash-merged
# branch looks unmerged and is kept.
#
# Usage: scripts/cleanup-merged.sh [--apply]   (default: dry run)
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
apply=0
[[ "${1:-}" == "--apply" ]] && apply=1

git fetch -q --prune origin
# The first entry of `git worktree list` is always the main checkout.
main_checkout="$(git worktree list --porcelain | head -n 1 | sed 's/^worktree //')"
current_branch="$(git rev-parse --abbrev-ref HEAD)"

finished() {
  [[ "$1" != "main" ]] \
    && [[ "$(git for-each-ref --format='%(upstream:track)' "refs/heads/$1")" == "[gone]" ]] \
    && git merge-base --is-ancestor "refs/heads/$1" origin/main
}

found=0

# Worktrees first: a branch can't be deleted while a worktree has it out.
while IFS=$'\t' read -r path branch; do
  [[ "$path" == "$main_checkout" ]] && continue
  finished "$branch" || continue
  found=1
  if [[ "$path" == "$root" ]]; then
    echo "skip      worktree $path ($branch): this script runs from it"
  elif ((apply)); then
    git worktree remove "$path" && echo "removed   worktree $path ($branch)"
  else
    echo "would remove worktree $path ($branch)"
  fi
done < <(git worktree list --porcelain \
  | awk '/^worktree /{path=substr($0, 10)} /^branch /{print path "\t" substr($0, 19)}')
git worktree prune

while read -r branch; do
  finished "$branch" || continue
  [[ "$branch" == "$current_branch" ]] && continue
  found=1
  if ((apply)); then
    git branch -d "$branch"
  else
    echo "would delete branch $branch"
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads)

if ((!found)); then
  echo "nothing to clean up"
elif ((!apply)); then
  echo "dry run; rerun with --apply to delete"
fi
