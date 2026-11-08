#!/usr/bin/env node
// What did that install change? Compares package-lock.json at a git ref
// with the working tree's, by installed path (node_modules/x, and nested
// copies separately). Prints every changed version and every removed
// package, the ones to read after `npm install` (an install can bump
// packages it wasn't asked to, within their ranges), and counts the added
// ones. Read-only; Node built-ins and git only.
//
// Usage: node scripts/lockfile-diff.mjs [ref] [--added]
//   ref      default: origin/main (not fetched; run `git fetch` first)
//   --added  list the added packages too, not just their count

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const listAdded = args.includes("--added");
const ref = args.find((arg) => !arg.startsWith("--")) ?? "origin/main";

let before;
try {
  before = execFileSync("git", ["show", `${ref}:package-lock.json`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch {
  console.error(`no package-lock.json at ${ref}`);
  process.exit(2);
}
const old = JSON.parse(before).packages;
const now = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8")).packages;

// The repo's own entries ("", workspaces) have no resolved version worth
// comparing; a workspace link ("frontend") points at a directory.
const isPackage = (path) => path.includes("node_modules/");
const added = Object.keys(now).filter((path) => isPackage(path) && !old[path]).sort();
const removed = Object.keys(old).filter((path) => isPackage(path) && !now[path]).sort();
const changed = Object.keys(old)
  .filter((path) => isPackage(path) && now[path] && old[path].version !== now[path].version)
  .sort();

console.log(`package-lock.json, ${ref} -> working tree`);
for (const path of changed) console.log(`changed  ${path}  ${old[path].version} -> ${now[path].version}`);
for (const path of removed) console.log(`removed  ${path}  ${old[path].version}`);
if (listAdded) for (const path of added) console.log(`added    ${path}  ${now[path].version}`);
console.log(`${changed.length} changed, ${removed.length} removed, ${added.length} added`);
