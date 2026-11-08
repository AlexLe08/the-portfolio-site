#!/usr/bin/env node
// What did that install change? Compares package-lock.json at a git ref
// with the working tree's, by installed path (node_modules/x, and nested
// copies separately). Prints every changed version and every removed
// package, the ones to read after `npm install` (an install can bump
// packages it wasn't asked to, within their ranges), and counts the added
// ones. A workspace link (node_modules/frontend) shows as "link".
// Read-only; Node built-ins and git only. Exits 0, or 2 on bad arguments,
// an unknown ref, or a ref or working tree without a root lockfile.
//
// Usage: node scripts/lockfile-diff.mjs [ref] [--added]
//   ref      default: origin/main (not fetched; run `git fetch` first)
//   --added  list the added packages too, not just their count

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const USAGE = "usage: node scripts/lockfile-diff.mjs [ref] [--added]";

function fail(message) {
  console.error(message);
  process.exit(2);
}

const args = process.argv.slice(2);
const listAdded = args.includes("--added");
const positional = args.filter((arg) => arg !== "--added");
// Anything else starting with "-" would reach git as an option.
if (positional.length > 1 || positional.some((arg) => arg.startsWith("-"))) fail(USAGE);
const ref = positional[0] ?? "origin/main";

let before;
try {
  before = execFileSync("git", ["show", `${ref}:package-lock.json`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  fail(`git show ${ref}:package-lock.json failed: ${String(error.stderr).trim() || error.message}`);
}
let current;
try {
  current = readFileSync(join(ROOT, "package-lock.json"), "utf8");
} catch {
  fail("no package-lock.json in the working tree: run npm install at the repository root");
}
const old = JSON.parse(before).packages ?? fail(`${ref}'s package-lock.json has no "packages" (lockfile v1?)`);
const now = JSON.parse(current).packages ?? fail('the working tree\'s package-lock.json has no "packages"');

// Installed packages only: the "" entry is the repository root, and the
// workspaces' own entries ("frontend") are directories, not installs.
const isPackage = (path) => path.includes("node_modules/");
const version = (entry) => (entry.link ? "link" : entry.version);
const added = Object.keys(now).filter((path) => isPackage(path) && !old[path]).sort();
const removed = Object.keys(old).filter((path) => isPackage(path) && !now[path]).sort();
const changed = Object.keys(old)
  .filter((path) => isPackage(path) && now[path] && version(old[path]) !== version(now[path]))
  .sort();

console.log(`package-lock.json, ${ref} -> working tree`);
for (const path of changed) console.log(`changed  ${path}  ${version(old[path])} -> ${version(now[path])}`);
for (const path of removed) console.log(`removed  ${path}  ${version(old[path])}`);
if (listAdded) for (const path of added) console.log(`added    ${path}  ${version(now[path])}`);
console.log(`${changed.length} changed, ${removed.length} removed, ${added.length} added`);
