# Plan: character sheet as an in-repo workspace package

Status: planned (planner agent, 2026-11-06), reviewed against the code the
same day (fixes folded in below). PR A done (#74, merged 2026-11-06);
PR B in progress. This is step 4
of the extraction path in `docs/roadmap.md` ("Extraction to its own
repository"):

1. Decide whether unknown keys should be strict or lenient.
2. Add the draft flag.
3. Design the slot-action API.
4. **Make the module an in-repo package (this plan).**
5. Move it to its own repository and publish it.

Step 4 changes no contract, so it can run alongside steps 1–3.

## How to continue

This file stays until PR C's roadmap entry replaces it. PR A merged
with the Vercel settings in risk 1 confirmed by the owner. The owner's
decisions are recorded under "Decisions" at the end.

Checked in Next 16's bundled docs (`node_modules/next/dist/docs/`):
- `turbopack.md`: Turbopack resolves only files inside a root it infers
  from the nearest lockfile, which is why the lockfile moves (decision 1).
- `transpilePackages.md`: Turbopack, and webpack under the App Router,
  transpile workspace packages automatically. `transpilePackages` is
  optional here (PR B step 5).
- `11-css.md`: a package's CSS can be imported anywhere in `app/`, so the
  component keeps importing its own.

## Goal and out of scope

**Goal:** `frontend/components/character-sheet/` becomes
`packages/eorzean-character-sheet`, with its own `package.json`, an `exports` map
and peer dependencies. The frontend uses it as an installed workspace
dependency. The JSON Schema gets a versioned `$id`, and the backend copy is
produced from the package. Rendering doesn't change at all.

**Out of scope:**
- A separate repository, publishing to npm, or a build step to `dist/`.
- CMS adapters and a demo site.
- Any change to the zod schema, the components or the CSS. The only
  exceptions are the `$id` line and removing two lint comments that only
  make sense under Next's lint rules (see PR B, step 3).
- Changing `findUnknownKeys`'s signature.

## Design decisions

**1. Where the workspace root goes: a root `package.json` with
`"workspaces": ["frontend", "packages/*"]` and one root
`package-lock.json`.**
- The alternative is a `file:../packages/eorzean-character-sheet` dependency,
  keeping the lockfile in `frontend/`. With that, the package's real path
  sits outside any `node_modules` that has `react` or `zod`, so its peer
  imports don't resolve.
- Next 16 also infers Turbopack's root from the lockfile's location. Files
  outside that root (`packages/`) aren't resolved unless you override
  `turbopack.root` and `outputFileTracingRoot` by hand.
- Workspaces put `react` and `zod` in the root `node_modules`, where the
  package can find them, and the root lockfile makes the repo root the
  inferred project root.

**2. How Next uses the package: TypeScript source through
`transpilePackages`, with no build step.**
- The `exports` targets point straight at `.ts`/`.tsx` files (a
  "just-in-time" internal package).
- A build step (tsc or tsup to `dist/`) adds output to keep in sync and a
  step that `check.sh`, CI and Vercel would all need. A bundler would also
  need extra care to keep `SlotHover`'s `"use client"` directive.
- Publishing will need a build step, so it belongs to step 5. `next build`
  already type-checks the package source, so no extra `tsc` step is
  needed (CLAUDE.md forbids one in CI anyway).

**3. The public API: three code entries plus two files**, so that
importing the data side doesn't pull in React or CSS. A single root barrel
would pull `CharacterSheet.tsx` and its CSS into server actions
(`app/admin/character-sheet/actions.ts`, `lib/character-admin.ts`), and
break the plain-Node `generate-schema` script and future CMS adapters.

Proposed `packages/eorzean-character-sheet/package.json`:

```json
{
  "name": "@alexle08/eorzean-character-sheet",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    ".": "./src/index.ts",
    "./react": "./src/CharacterSheet.tsx",
    "./schema": "./src/schema.ts",
    "./character-sheet.css": "./src/character-sheet.css",
    "./character-sheet.schema.json": "./character-sheet.schema.json",
    "./package.json": "./package.json"
  },
  "scripts": { "lint": "eslint", "generate:schema": "node scripts/generate-schema.mjs" },
  "peerDependencies": { "react": "^19", "zod": "^4" },
  "devDependencies": { "eslint": "^9", "typescript-eslint": "^8", "eslint-plugin-react-hooks": "^7", "eslint-plugin-jsx-a11y": "^6" }
}
```

What each entry holds:
- **`.`** (new `src/index.ts`, React-free): `parseConfig`, `loadConfig`,
  `findUnknownKeys`, `resolveJob`, `jobHref`, `actionHref`, and the types
  from `types.ts` and `parse.ts` (`CharacterSheetConfig`, `Job`,
  `Portrait`, `SlotAction`, `Tooltip`, `ConfigSource`, `ParseResult`,
  `LoadResult`, …).
- **`./react`**: `CharacterSheet`, `CharacterSheetProps`,
  `LinkRendererProps`. The component keeps importing its own CSS.
- **`./schema`**: the zod schemas and constants.
- **CSS export:** for hosts that want to control CSS order. The site
  doesn't use it.
- **JSON Schema export:** the contract other backends validate against.

Flagged:
- **`SlotHover`** stays private: no entry exports it, and the site never
  imports it.
- **Sub-schemas and constants:** the admin form
  (`app/admin/character-sheet/page.tsx:4-13,32-59`) reads
  `jobSchema.shape`, `pairSchema.shape.label.maxLength`,
  `slotActionSchema.options`, `ID_PATTERN` and the `TOOLTIP_MAX_*`
  constants. Exporting them through `./schema` makes zod's internal shape
  part of the public API. Keep for now; before extraction, decide whether
  to replace them with a plain `LIMITS` object.
- **`findUnknownKeys`'s extra `path` argument** (`parse.ts:81`) is a
  recursion detail in the public signature. Leave it; note it in the
  roadmap.
- **`LinkRendererProps` and `Portrait`** (used in
  `lib/character-render.tsx`) are rightly public.

**4. Package name: `@alexle08/eorzean-character-sheet`** (owner's
choice), in `packages/eorzean-character-sheet/` so the folder matches the
name. The files inside keep their names (`character-sheet.css`,
`character-sheet.schema.json`). npm scopes are lowercase and must match an
npm user or org you own. Nothing is reserved while the package is
private; check the scope is free before step 5.
- "Eorzea" is Final Fantasy XIV's setting and a Square Enix trademark.
  Harmless in a private package; before publishing, check Square Enix's
  fan-content terms or choose a neutral published name.

**5. `$id` form:
`https://cdn.jsdelivr.net/npm/@alexle08/eorzean-character-sheet@1/character-sheet.schema.json`.**
`generate-schema.mjs` builds it from `name` and the major part of
`version` in `package.json`.
- A URL on the Vercel site would tie the contract to this site's
  subdomain; a GitHub raw URL would point at a repo that doesn't exist
  yet; a URN can't be opened. An npm CDN URL keyed by major version
  survives the repo move and opens once published.
- A compatible schema change keeps `@1`; a breaking one changes the `$id`.
- Start at `1.0.0`: the schema is already a deployed contract with stored
  rows in Neon, and 0.x would say anything can break.

**6. Where the generator lives.**
- `generate-schema.mjs` moves to
  `packages/eorzean-character-sheet/scripts/generate-schema.mjs`, runs as the
  package's `generate:schema`, and writes only the package's own
  `character-sheet.schema.json`. The package doesn't know `../backend`
  exists. With `"type": "module"`, the
  `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` flag can go.
- Moving it into `scripts/` changes its two relative paths: the import
  becomes `../src/schema.ts` and the output
  `new URL("../character-sheet.schema.json", import.meta.url)`. Its header
  comment's command stays `npm run generate:character-schema` (from
  `frontend/`).
- `generate:character-schema` stays in `frontend/package.json`:
  `npm --prefix ../packages/eorzean-character-sheet run generate:schema && cp ../packages/eorzean-character-sheet/character-sheet.schema.json ../backend/app/services/character_sheet.schema.json`.
  Copying into the backend is the site's wiring, and implementers then
  never touch root files. After step 5, the `cp` source becomes the
  installed package in `node_modules`.

**7. Enforcing the boundary: the package's own `eslint.config.mjs`, run by
the frontend's `lint` script.**
- A `tsconfig` can't do it: when `next build` compiles the package, the
  frontend's `paths: {"@/*"}` applies to every file, so an `@/` import
  would quietly resolve.
- The frontend's ESLint can't reach it either: ESLint 9 ignores files
  outside the base directory.
- The package config uses the `typescript-eslint` parser and recommended
  rules plus `react-hooks` recommended rules, and adds
  `no-restricted-imports` with an allowlist: anything other than `react`,
  `react/…`, `zod` or `./…` is an error (blocks `@/`, `next`, `next/*`,
  `../` and `globals.css`). `scripts/` may also import `node:` modules and
  `../src/…` (the generator imports `../src/schema.ts`).
- It also adds `eslint-plugin-jsx-a11y` recommended rules. The site's lint
  gets them through `eslint-config-next`; without them the package, which
  renders all the sheet's markup, would lose its accessibility checks.
- Frontend `lint` becomes
  `"eslint && npm --prefix ../packages/eorzean-character-sheet run lint"`, so CI
  and `scripts/check.sh` cover the package unchanged.
- The `exports` map also stops the site from reaching inside the package.
- **Gotcha:** `CharacterSheet.tsx:67` and `:202` have
  `// eslint-disable-next-line @next/next/no-img-element`. Without the
  Next plugin, ESLint 9 reports "Definition for rule … was not found".
  Remove both comments.

**8. Ownership: `frontend-implementer` owns `packages/`.** Same toolchain
(npm, ESLint, `next build`, `check.sh frontend`), and the frontend is its
only user. The root `package.json` (no scripts) stays orchestrator-owned;
npm writing the root `package-lock.json` becomes an allowed generator
crossing.

## Tasks, in order

### PR A: workspace root, no code change

Owner: orchestrator. Branch: `chore/npm-workspace-root`. Tests the install
change on its own, before any code moves.

1. **Root `package.json`:**
   `{"name": "the-portfolio-site", "private": true, "workspaces": ["frontend", "packages/*"]}`.
   If npm complains about `packages/*` matching nothing, list only
   `frontend` and add `packages/*` in PR B.
2. **Lockfile:** `git mv frontend/package-lock.json package-lock.json`,
   then `npm install` at the root.
   - It must not re-resolve anything. Compare the sorted set of
     `name@version` pairs from the lockfile's `packages` before and after
     (a raw `npm ls --all` diff is noisy: the tree's root becomes the
     workspace root). Expect no version changes. If any changed, stop and
     report.
   - `npm ls react zod`: one deduped copy of each.
3. **Root `.gitignore`:** add `node_modules/`.
4. **`.github/workflows/frontend.yml`:**
   - Install step: `working-directory: .`.
   - `cache-dependency-path: package-lock.json`.
   - Add `packages/**`, `package.json` and `package-lock.json` to the
     `push: main` paths. No filters on `pull_request`.
   - Job id stays `build`. Lint and build still run from `frontend/`.
5. **`.github/workflows/smoke.yml`:** same install and cache changes.
6. **`scripts/setup-worktree.sh:21-22`:** run `npm ci` at `$root`.
7. **`frontend/demo/stack.mjs:148`:** `./node_modules/.bin/next` breaks
   once hoisted. Spawn `process.execPath` with
   `createRequire(import.meta.url).resolve("next/dist/bin/next")`.
8. **Agent scope:**
   - `.claude/hooks/scope-edits.py:26,35`: accept several allowed
     directories (`allowed = sys.argv[1:]`, then
     `parts[1] not in (*allowed, ".logs")`), and fix the messages.
   - `.claude/agents/frontend-implementer.md:12`: hook command
     `scope-edits.py frontend packages`; description and line 25 mention
     `packages/`.
   - `.claude/agents/reviewer.md` scope bullet: `packages/` belongs to the
     frontend implementer; the root `package-lock.json` is generator
     output.
9. **Docs:**
   - CLAUDE.md "What this is": add `packages/`.
   - CLAUDE.md "Commands": installs run at the repo root (`npm ci`); the
     `setup-worktree.sh` entry.
   - CLAUDE.md "Agent workflow": frontend implementer owns `frontend/` and
     `packages/`; root lockfile joins the generator-crossing list.
   - `docs/ci-cd-runbook.md:14`.
   - `docs/vercel-runbook.md` "Initial setup": the workspace install and
     the settings in risk 1.
   - `frontend/README.md:9`: `npm install` from the repo root.

**Verification:**
- `scripts/check.sh`.
- A fresh `scripts/new-worktree.sh` (using this branch's
  `setup-worktree.sh`), then `scripts/check.sh frontend`.
- `node demo/screenshot.mjs /` on the new stack.
- `scripts/local-stack.sh` prints `ready`.
- `npx playwright --version` from `frontend/`.
- CI `build` and `test` green.
- **Owner:** the PR's Vercel preview build log shows install at the repo
  root and a successful build; home, `/lab/character-sheet` and `/admin`
  render.

Merge PR A (with the scope changes) before PR B: the hook and agent
definitions are read from the main checkout.

### PR B: move the module into the package, no content change

Branch: `refactor/character-sheet-package`, one worktree.
`frontend-implementer` first, then `backend-implementer` on the same
branch (moving the JSON breaks the backend test until its path changes).

**B1, frontend-implementer:**
1. **Move with history:** `git mv` `CharacterSheet.tsx`, `SlotHover.tsx`,
   `parse.ts`, `resolve.ts`, `schema.ts`, `types.ts`,
   `character-sheet.css` into `packages/eorzean-character-sheet/src/`;
   `character-sheet.schema.json` and `README.md` to the package root;
   `generate-schema.mjs` to `packages/eorzean-character-sheet/scripts/`. The
   schema JSON stays byte-identical.
2. **New files:** the package's `package.json` (decision 3),
   `src/index.ts` (re-exports only), `eslint.config.mjs` (decision 7).
   `npm install` at the root. The lockfile diff should add only the
   workspace link and the dev-dependency entries, with nothing new
   downloaded (`typescript-eslint` 8.70.1, `eslint-plugin-react-hooks`
   7.1.1, `eslint` 9.39.5 and `eslint-plugin-jsx-a11y` 6.10.2 are already
   in the tree).
   In `scripts/generate-schema.mjs`, update the import and output paths
   (decision 6).
3. **Remove the two `@next/next/no-img-element` comments**
   (`CharacterSheet.tsx:67,202`).
4. **`frontend/package.json`:**
   - Add `"@alexle08/eorzean-character-sheet": "^1.0.0"` (npm has no
     `workspace:` protocol; a matching range links the local copy).
   - Keep `react` and `zod` as the host's copies of the peers; say so in
     the PR.
   - Update `lint` and `generate:character-schema` (decisions 6 and 7).
5. **`frontend/next.config.ts`:** nothing required; Next transpiles
   workspace packages itself (see "How to continue"). Add
   `transpilePackages: ["@alexle08/eorzean-character-sheet"]` only if the build
   fails to compile the package's TypeScript.
6. **Rewrite imports** to package entries in:
   - `app/page.tsx:5-6`
   - `app/lab/character-sheet/page.tsx:2-3`
   - `app/admin/character-sheet/page.tsx:3-13`
   - `app/admin/character-sheet/actions.ts:5`
   - `lib/character.ts:3-9`
   - `lib/character-admin.ts:2`
   - `lib/character-render.tsx:3-4`
   - `components/CharacterJobForm.tsx:4`
   - `components/SlotActionFields.tsx:4`
   - `components/SlotTooltipFields.tsx:4`
   - Comments naming the old path: `lib/character.ts:14-15`, and
     `schema.ts:8` ("this package").
7. **`frontend/lib/character-config.json:2`:**
   `"$schema": "../../packages/eorzean-character-sheet/character-sheet.schema.json"`.
8. **Package README:** file table, usage imports
   (`@alexle08/eorzean-character-sheet`, `/react`), the `exports` list, and
   "imports nothing but react and zod, enforced by `eslint.config.mjs`".

New behaviour gets a test: the frontend has no unit-test runner, so show
`scripts/check.sh frontend` failing on a temporary `import "@/lib/api"` in
the package, then remove it.

**B2, backend-implementer** (same branch, after B1):
- `backend/tests/test_character_sheet.py:12-14`: rename `FRONTEND_SCHEMA`
  to `PACKAGE_SCHEMA`, pointing at
  `REPO / "packages/eorzean-character-sheet/character-sheet.schema.json"` (repo
  path, not `node_modules`: backend CI never runs npm). Rename the test to
  `test_schema_copy_matches_package`; the assertion doesn't change.
- Update the docstring at `backend/app/services/character_sheet.py:3-8`.
- `scripts/check.sh` (both sides).
- `scripts/mutate.py` against the test: changing one byte of
  `backend/app/services/character_sheet.schema.json` is still caught.

**Verification (no behaviour change), on the demo stack:**
- **Screenshots** before (an `origin/main` worktree) and after with
  `node demo/screenshot.mjs` for `/`, `"/?job=ecommerce"`,
  `/lab/character-sheet`, `/admin/character-sheet` and
  `/admin/character-sheet/json`; compare pixel for pixel. Any difference
  blocks the PR.
- **HTML** of `/` and `/lab/character-sheet` differs only in asset
  hashes; the `.cs` rules appear once in `.next/static/**/*.css`.
- **Behaviour** (`.webm` with `stack.mjs` `step()`): hover shows a
  tooltip, Escape hides it (`SlotHover` hydrated), the job menu switches
  jobs, saving a job in the admin form works.
- `npm run generate:character-schema` leaves `git status` clean.
- **Owner:** the Vercel preview build and the same pages on the preview.

### PR C: versioned `$id`

Branch: `feat/character-schema-id`.

**C1, frontend-implementer:** `generate-schema.mjs` adds `$id`
(decision 5), built from `package.json`. Run
`npm run generate:character-schema` (rewrites the package's schema JSON
and the backend copy, an allowed crossing). Add the `$id` and versioning
rule to the README.

**C2, backend-implementer** (same branch): new test
`test_schema_has_versioned_id`, asserting `$id` matches
`^https://cdn\.jsdelivr\.net/npm/@alexle08/eorzean-character-sheet@\d+/character-sheet\.schema\.json$`.
All existing validation tests must still pass. (The generated schema has
no `$defs` or `$ref`s, because zod inlines everything, so an absolute
`$id` can't change reference resolution today. If a later zod version
emits `$ref`s, add a test that validation fetches nothing.) `scripts/check.sh` (both sides).

**Verification:** the bundled config still validates on both sides
(`test_bundled_config_is_valid`, plus the build-time `parseConfig` in
`lib/character.ts:21`). Saving the admin JSON on the demo stack works.

## Orchestrator's docs updates (after PRs B and C)

- **CLAUDE.md "Frontend":** client list gets
  `packages/eorzean-character-sheet/src/SlotHover.tsx`; the module paragraph gets
  the package path, entries, ESLint enforcement, and that
  `generate:character-schema` (run from `frontend/`) also writes the
  backend copy.
- **CLAUDE.md "Architecture rules":** `services/character_sheet.py`
  validates against a copy of the package's schema.
- **`.claude/agents/frontend-implementer.md`** (grep for `schema.ts`;
  the line number has drifted): "after changing
  `packages/eorzean-character-sheet/src/schema.ts`".
- **`docs/roadmap.md`:** record the in-repo package as done (with the PR
  links), the `$id` form and versioning rule, and the install change.
  What's left for step 5: its own repo, a build step for publishing, the
  npm scope, the "Eorzean" trademark check (decision 4), CMS adapters,
  the demo site, `LIMITS` instead of exported sub-schemas, and
  `findUnknownKeys`'s `path` argument. Also from PR B's review:
  - Accessibility: the non-link slot face (`CharacterSheet.tsx`, the
    `<span tabIndex={0}>`) is a focus stop with no role. Give it one
    (`role="group"` with `aria-labelledby` its label, or a
    `<button type="button">`), then drop its `no-noninteractive-tabindex`
    disable. Do this before publishing.
  - The package lint dropped `eslint-plugin-react` rules (`react/jsx-key`,
    `react/no-unescaped-entities`) that `eslint-config-next` applied; add
    the plugin (already in the tree) at extraction.
  - The import allowlist (`no-restricted-imports`) doesn't see dynamic
    `import()` or `require()`; add a `no-restricted-syntax` rule if the
    package ever uses them.
- Delete this plan file once it's recorded in the roadmap.

## Dependencies and migrations

- New npm dev dependencies, in the package only: `eslint`,
  `typescript-eslint`, `eslint-plugin-react-hooks`,
  `eslint-plugin-jsx-a11y`. All already in the lockfile through
  `eslint-config-next`.
- No new runtime dependencies. No Alembic migrations, no data dropped:
  `$id` is a schema keyword, not a config field.

## Risks, and what can only be checked after merge

1. **Vercel install (highest risk).** Owner checks under Settings > Build
   and Deployment:
   - Root Directory stays `frontend`.
   - "Include files outside the root directory in the Build Step" is
     Enabled.
   - Install Command is the default, not an override like
     `cd frontend && npm ci`.
   - No custom "Ignored Build Step" that only diffs `frontend/`.

   All free-tier. Previews use production settings, so PR A's preview is
   a real check before merge. Not checkable before merge: the production
   deploy, and `smoke.yml`'s new install step (owner can run it on the
   branch via `workflow_dispatch`; agents can't, it hits production).
2. **Lockfile drift** when the lockfile moves. The `npm ls --all`
   comparison catches it.
3. **Hoisting assumptions.** `require.resolve` in `stack.mjs` covers the
   one known case; grep found no other `frontend/node_modules` use in
   `scripts/` or `demo/`.
4. **Turbopack root and file tracing** on Vercel, inferred from the root
   lockfile. If admin pages or Server Actions fail with missing modules on
   the preview, set `outputFileTracingRoot`/`turbopack.root` explicitly.
5. **CSS from a transpiled package** under the App Router. The PR B
   before/after comparison catches a problem.
6. **Render is unaffected.** `render.yaml:6` has `rootDir: backend`, and
   the Docker context only reads the committed
   `backend/app/services/character_sheet.schema.json`. PRs B and C each
   trigger a no-op Render redeploy.

## Decisions (owner, 2026-11-06)

1. **Name:** `@alexle08/eorzean-character-sheet`. Check the scope is free
   and the trademark question (decision 4) before step 5.
2. **Starting version and `$id`:** `1.0.0` and the jsDelivr form.
3. **Zod sub-schemas through `./schema`:** public for now; `LIMITS` is a
   step-5 question.
4. **`frontend-implementer` owns `packages/`:** done in PR A.
5. **Vercel settings:** confirmed before PR A merged.
