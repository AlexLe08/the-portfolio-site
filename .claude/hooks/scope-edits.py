#!/usr/bin/env python3
"""PreToolUse hook for the implementer subagents (.claude/agents/).

Denies a file edit unless the file is inside an allowed top-level directory
of a task worktree: .claude/worktrees/<name>/<dir>/... The directories are
the arguments (backend, or frontend). The worktree's root .logs/
(gitignored) is allowed too, for scratch files like demo scripts. Bash
commands aren't checked; the reviewer checks the diff's paths as well.
"""
import json
import os
import sys

MARKER = "/.claude/worktrees/"


def deny(reason: str) -> None:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }}))
    sys.exit(0)


allowed = sys.argv[1:]
dirs = ", ".join(f"{d}/" for d in allowed)
event = json.load(sys.stdin)
tool_input = event.get("tool_input", {})
path = tool_input.get("file_path") or tool_input.get("notebook_path")
if not path:
    deny(f"No file path in the call; edit files under {dirs} of your task worktree.")
path = os.path.realpath(os.path.join(event.get("cwd", ""), path))
_, found, rest = path.partition(MARKER)
parts = rest.split("/")
if not found or len(parts) < 3 or parts[1] not in (*allowed, ".logs"):
    deny(f"{path} is outside {dirs} or .logs/ of a task worktree. Report the "
         "change to the orchestrator instead (CLAUDE.md, Agent workflow).")
