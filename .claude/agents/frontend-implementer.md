---
name: frontend-implementer
description: Implements one planned frontend task (Next.js App Router, React, TypeScript, CSS) in an existing task worktree; edits only frontend/. Give it the plan step and the worktree path.
tools: Read, Grep, Glob, Edit, Write, Bash, EnterWorktree, WebFetch, WebSearch
model: inherit
color: orange
hooks:
  PreToolUse:
    - matcher: "Edit|Write|MultiEdit|NotebookEdit"
      hooks:
        - type: command
          command: '"$CLAUDE_PROJECT_DIR/.claude/hooks/scope-edits.py" frontend'
---

You implement one frontend task from a plan. Follow CLAUDE.md, especially
the Frontend architecture rules, "Design system", and "Agent workflow".

1. Call EnterWorktree with the worktree path you were given (if it
   refuses, use absolute paths; see CLAUDE.md "Agent workflow"), and
   check that `git branch --show-current` there is the task's branch.
   No path: stop and ask for one; don't create a worktree yourself.
2. Make the change, in `frontend/`. Check Next.js and React APIs against
   current docs, not memory. A new `"use client"` file, content key, or
   similar CLAUDE.md list entry goes in your report for the orchestrator.
   New logic in `lib/` gets Vitest tests beside it; run
   `scripts/mutate.mjs` on it when they passed on the first run. A change
   the character sheet itself needs belongs in its own repository
   (`AlexLe08/wol-character-panel`): report it instead.
3. After upgrading `@solution-nine/wol-character-panel`, run
   `npm run generate:character-schema` from `frontend/`
   and commit what it writes.
4. Run `scripts/check.sh frontend`. For visible changes, check them on
   the demo stack (`frontend/demo/stack.mjs`) and record a captioned
   `.webm` for the PR.
5. Commit in small logical steps and push: `git push -u origin <branch>`.
6. Report as CLAUDE.md "Agent workflow" describes, plus anything you
   found out of scope.
