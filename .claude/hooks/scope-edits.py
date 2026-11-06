#!/usr/bin/env python3
"""PreToolUse hook for the implementer subagents (.claude/agents/).

Denies a file edit unless the file is inside one top-level directory of a
task worktree: .claude/worktrees/<name>/<dir>/... The directory is the
first argument (backend or frontend). Bash commands aren't checked; the
reviewer checks the diff's paths as well.
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


allowed = sys.argv[1]
event = json.load(sys.stdin)
tool_input = event.get("tool_input", {})
path = tool_input.get("file_path") or tool_input.get("notebook_path")
if not path:
    deny(f"No file path in the call; edit files under {allowed}/ of your task worktree.")
path = os.path.realpath(os.path.join(event.get("cwd", ""), path))
_, found, rest = path.partition(MARKER)
parts = rest.split("/")
if not found or len(parts) < 3 or parts[1] != allowed:
    deny(f"{path} is outside {allowed}/ of a task worktree. Report the "
         "change to the orchestrator instead (CLAUDE.md, Agent workflow).")
