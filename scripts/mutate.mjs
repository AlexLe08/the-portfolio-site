#!/usr/bin/env node
// Would the tests notice if this code broke? The frontend twin of
// scripts/mutate.py: breaks the code on purpose, one change at a time,
// runs the Vitest suites, and reports which tests failed. A change no test
// catches is a gap in the tests. Node built-ins only.
//
// One change:
//
//     node scripts/mutate.mjs frontend/lib/character-anchors.ts \
//         'action.name === STACK_PARAM' 'false'
//
// Several, from a JSON list of {"name", "file", "old", "new"} objects
// (paths from the repository root):
//
//     node scripts/mutate.mjs mutations.json -- lib/character-anchors
//
// Each `old` must appear exactly once in its file. Every change runs both
// suites, frontend/ (lib/) and the character sheet package, as `npm test`
// does, since a package change can break a lib/ test. Arguments after `--`
// go to `vitest run` in both (file filters, -t "name"); a suite they match
// nothing in passes. Don't pass --reporter or --outputFile: the script
// reads its own JSON report, and without it a change reads as unnoticed.
// The file is always restored, also on Ctrl-C or kill;
// a copy is kept in .logs/mutate-backup/ until then, in case the process
// is killed outright. Exits 1 if any change went unnoticed, 2 on bad
// arguments (before anything is changed).

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VITEST = join(ROOT, "node_modules", ".bin", "vitest");
const SUITES = ["frontend", "packages/eorzean-character-sheet"];
const BACKUPS = join(ROOT, ".logs", "mutate-backup");
const REPORTS = join(ROOT, ".logs", "mutate-reports");

const USAGE = `usage: node scripts/mutate.mjs FILE OLD NEW [-- vitest args]
       node scripts/mutate.mjs MUTATIONS.json [-- vitest args]`;

function fail(message) {
  console.error(message);
  process.exit(2);
}

function loadMutations(args) {
  if (args.length === 1 && args[0].endsWith(".json")) return JSON.parse(readFileSync(args[0], "utf8"));
  if (args.length === 3) {
    const [file, old, replacement] = args;
    return [{ name: `${JSON.stringify(old)} -> ${JSON.stringify(replacement)}`, file, old, new: replacement }];
  }
  fail(USAGE);
}

// Fail before changing anything if a mutation can't apply cleanly.
function check(mutations) {
  if (!existsSync(VITEST)) fail(`${VITEST} not found: run npm ci at the repository root`);
  for (const mutation of mutations) {
    const count = readFileSync(resolve(ROOT, mutation.file), "utf8").split(mutation.old).length - 1;
    if (count !== 1) fail(`${mutation.name}: \`old\` appears ${count} times in ${mutation.file}, not once`);
  }
}

// The file being mutated right now, so a signal can put it back, and the
// vitest process running against it, so a signal can stop it too.
let current = null;
let child = null;

// One suite's failing tests, as "suite: test name". A file that didn't
// load (a syntax error the change introduced) counts as one failure, and
// so does a non-zero exit with no failed test in the report: the JSON
// reporter leaves out errors outside tests (an unhandled rejection).
function runSuite(suite, vitestArgs) {
  // Vitest 5's JSON reporter writes a file, not stdout. Removed first, so a
  // run that writes nothing can't be read as the last run's report.
  const reportPath = join(REPORTS, `${basename(suite)}.json`);
  mkdirSync(REPORTS, { recursive: true });
  rmSync(reportPath, { force: true });
  return new Promise((done) => {
    child = spawn(
      VITEST,
      ["run", "--reporter=json", `--outputFile=${reportPath}`, "--passWithNoTests", ...vitestArgs],
      { cwd: join(ROOT, suite), stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    // Without this, a failed spawn throws outside the promise and run()'s
    // finally never restores the file.
    child.on("error", (error) => {
      child = null;
      done([`${suite}: vitest didn't start (${error.message})`]);
    });
    child.on("close", (code) => {
      child = null;
      // The line naming the error ("CACError: Unknown option"), not the
      // stack trace after it.
      const lines = stderr.split("\n").map((line) => line.trim()).filter(Boolean);
      const reason = lines.find((line) => /^\w*Error\b/.test(line)) ?? lines[0] ?? "no output";
      let report;
      try {
        report = JSON.parse(readFileSync(reportPath, "utf8"));
      } catch {
        done(code === 0 ? [] : [`${suite}: vitest exited ${code} without a report: ${reason}`]);
        return;
      }
      const failed = report.testResults.flatMap((file) => {
        const tests = file.assertionResults.filter((test) => test.status === "failed");
        if (tests.length) return tests.map((test) => `${suite}: ${test.fullName}`);
        return file.status === "failed" ? [`${suite}: ${basename(file.name)} (didn't run)`] : [];
      });
      if (failed.length === 0 && code !== 0) failed.push(`${suite}: vitest exited ${code} (errors outside tests)`);
      done(failed);
    });
  });
}

function restore() {
  if (!current) return;
  writeFileSync(current.path, current.original);
  rmSync(current.backup, { force: true });
  current = null;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child?.kill();
    restore();
    process.exit(1);
  });
}
// A backstop for anything else that ends the process early (an uncaught
// exception); restore() is synchronous and does nothing the second time.
process.on("exit", restore);

// Apply one mutation, run both suites, restore. Returns the failing tests.
async function run(mutation, vitestArgs) {
  const path = resolve(ROOT, mutation.file);
  const original = readFileSync(path, "utf8");
  mkdirSync(BACKUPS, { recursive: true });
  const backup = join(BACKUPS, basename(path));
  copyFileSync(path, backup);
  current = { path, original, backup };
  try {
    writeFileSync(path, original.replace(mutation.old, () => mutation.new));
    const results = [];
    for (const suite of SUITES) results.push(...(await runSuite(suite, vitestArgs)));
    return results;
  } finally {
    restore();
  }
}

const args = process.argv.slice(2);
const split = args.indexOf("--");
const vitestArgs = split === -1 ? [] : args.slice(split + 1);
const mutations = loadMutations(split === -1 ? args : args.slice(0, split));
check(mutations);

let survived = 0;
for (const mutation of mutations) {
  const caught = await run(mutation, vitestArgs);
  if (caught.length) {
    console.log(`caught    ${mutation.name}  (${caught.length} failing)`);
    for (const test of caught) console.log(`            ${test}`);
  } else {
    survived += 1;
    console.log(`SURVIVED  ${mutation.name}  (no test failed)`);
  }
}
process.exit(survived ? 1 : 0);
