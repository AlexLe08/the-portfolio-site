"""Run once against a fresh database: python seed.py"""

from app.database import SessionLocal
from app.models import Project

DISCORD_BOT_CASE_STUDY = """\
# A TypeScript Backend Case Study

A solo project that grew from a simple reminder message into a fully
tested, CI/CD-deployed backend service managing scheduled, persistent
reminders across Discord servers and direct messages.

## Architecture

- **Persistence layer** — SQLite with typed queries and SQL-side
  due-reminder queries, pushing time-window logic into the database.
- **Scheduler** — a single polling loop, not per-reminder timers, with
  isolated error handling per reminder and an overlap guard.
- **Command layer** — a discord.js slash-command framework with
  per-command cooldowns and hot-reloading.
- **Deployment** — a self-managed Ubuntu VM via Node's native TypeScript
  execution, managed by systemd.

## Three incidents worth talking about

1. A test suite catching a bug already live in production — an inner
   JOIN was silently excluding servers that had never touched a
   settings toggle.
2. Root-causing duplicate messages across two live environments — a
   shared Discord credential between local dev and production.
3. One failure crashing the whole service — an unhandled second
   failure in an error-fallback path.

## Engineering practices

~96% test coverage, CI enforced via a branch ruleset, and CD with a
human approval gate before anything touches production.
"""

SEARCH_LIBRARY_CASE_STUDY = """\
# Enterprise UI Library Case Study

A production-grade React component library built to demonstrate
component design, accessibility, and testing rigor. The centerpiece is
a `SearchInput` component with autosuggest, recent searches, and full
keyboard navigation.

## Architecture decisions

- **Discriminated union state**, not boolean flags — contradictory
  states like "loading and errored" are impossible.
- **Race-condition safety** via AbortController and monotonic request
  IDs, tested against out-of-order responses.
- **Portal-rendered dropdown** via Floating UI, escaping ancestor
  `overflow: hidden` and `transform` traps.

## Testing

89 tests across four layers — utilities, hooks, subcomponents, and
integration — with 100% coverage on hooks and utilities.

## Accessibility

Full ARIA combobox pattern, keyboard-complete, with `aria-activedescendant`
used instead of moving DOM focus so screen reader users can keep typing
while navigating suggestions.
"""


def seed():
    db = SessionLocal()
    try:
        db.add(
            Project(
                slug="discord-reminder-bot",
                title="Production Discord Bot",
                summary="A TypeScript backend service for scheduled, persistent reminders across Discord servers and DMs.",
                stack=["TypeScript", "discord.js", "SQLite", "Vitest", "GitHub Actions"],
                case_study_md=DISCORD_BOT_CASE_STUDY,
                repo_url=None,
                published=True,
            )
        )
        db.add(
            Project(
                slug="enterprise-search-input",
                title="Enterprise UI Library — SearchInput",
                summary="A production-grade React component library with autosuggest, accessibility, and 89 tests.",
                stack=["React", "TypeScript", "Vite", "Floating UI", "Vitest"],
                case_study_md=SEARCH_LIBRARY_CASE_STUDY,
                repo_url=None,
                published=True,
            )
        )
        db.commit()
        print("Seeded 2 projects.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
