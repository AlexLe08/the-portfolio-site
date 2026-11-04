#!/usr/bin/env python3
"""Would the tests notice if this code broke? Breaks it on purpose, one
change at a time, runs the backend tests, and reports which tests failed.
A change no test catches is a gap in the tests. Standard library only.

One change:

    python3 scripts/mutate.py backend/app/services/media.py \\
        "if size > MAX:" "if False:" -- tests/test_media.py

Several, from a JSON list of {"name", "file", "old", "new"} objects
(paths from the repository root):

    python3 scripts/mutate.py mutations.json -- tests/test_character_sheet.py

Each `old` must appear exactly once in its file. Arguments after `--` go
to pytest (default: the whole suite), run from backend/. The file is
always restored, also on Ctrl-C; a copy is kept in .logs/mutate-backup/
until then, in case the process is killed outright. Exits 1 if any change
went unnoticed.
"""

import json
import shutil
import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
BACKUPS = ROOT / ".logs" / "mutate-backup"


USAGE = """usage: scripts/mutate.py FILE OLD NEW [-- pytest args]
       scripts/mutate.py MUTATIONS.json [-- pytest args]"""


def load_mutations(args: list[str]) -> list[dict[str, str]]:
    if len(args) == 1 and args[0].endswith(".json"):
        return json.loads(Path(args[0]).read_text(encoding="utf-8"))
    if len(args) == 3:
        file, old, new = args
        return [{"name": f"{old!r} -> {new!r}", "file": file, "old": old, "new": new}]
    sys.exit(USAGE)


def check(mutations: list[dict[str, str]]) -> None:
    """Fail before changing anything if a mutation can't apply cleanly."""
    for mutation in mutations:
        path = ROOT / mutation["file"]
        count = path.read_text(encoding="utf-8").count(mutation["old"])
        if count != 1:
            sys.exit(f"{mutation['name']}: `old` appears {count} times in {mutation['file']}, not once")


def run(mutation: dict[str, str], pytest_args: list[str]) -> list[str]:
    """Apply one mutation, run pytest, restore. Returns the failing tests."""
    path = ROOT / mutation["file"]
    original = path.read_text(encoding="utf-8")
    BACKUPS.mkdir(parents=True, exist_ok=True)
    backup = BACKUPS / path.name
    shutil.copy2(path, backup)
    try:
        path.write_text(original.replace(mutation["old"], mutation["new"], 1), encoding="utf-8")
        result = subprocess.run(
            ["./.venv/bin/pytest", "-q", "-p", "no:cacheprovider", *pytest_args],
            cwd=BACKEND,
            capture_output=True,
            text=True,
        )
    finally:
        path.write_text(original, encoding="utf-8")
        backup.unlink()
    failed = [line.split(" - ")[0].removeprefix("FAILED ") for line in result.stdout.splitlines()
              if line.startswith("FAILED")]
    errored = [line.split(" - ")[0] for line in result.stdout.splitlines() if line.startswith("ERROR")]
    return failed + errored


def main() -> None:
    args = sys.argv[1:]
    pytest_args: list[str] = []
    if "--" in args:
        split = args.index("--")
        args, pytest_args = args[:split], args[split + 1:]
    mutations = load_mutations(args)
    check(mutations)
    # A plain `kill` (SIGTERM) restores the file too, by unwinding through
    # run()'s finally, the way Ctrl-C does.
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(1))

    survived = 0
    for mutation in mutations:
        caught = run(mutation, pytest_args)
        if caught:
            print(f"caught    {mutation['name']}  ({len(caught)} failing)")
            for test in caught:
                print(f"            {test}")
        else:
            survived += 1
            print(f"SURVIVED  {mutation['name']}  (no test failed)")
    sys.exit(1 if survived else 0)


if __name__ == "__main__":
    main()
