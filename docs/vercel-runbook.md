# Vercel (Frontend hosting)

Vercel hosts the Next.js frontend, deployed directly from GitHub.

## Why Vercel, specifically

No card required for the Hobby tier, and — unlike Render or Neon — there's
no billing method attachable without a deliberate upgrade flow, so it's
structurally impossible to be charged on this tier. Also the most natural
fit technically: Vercel is built by the Next.js team, so framework
features (automatic font optimization, the App Router, per-route
static/dynamic rendering) are first-class here without extra config.

## Initial setup

1. vercel.com → sign in → **Import** the GitHub repo.
2. Set **Root Directory** to `frontend`. This is the monorepo equivalent
   of `rootDir: backend` in `render.yaml` — without it, Vercel looks for a
   Next.js app at the repo root and won't find one.
3. Add an environment variable: `NEXT_PUBLIC_API_URL` = the Render backend
   URL (`https://portfolio-backend-leto.onrender.com`, no trailing slash).
4. Under Settings > Build and Deployment, check the npm workspace setup
   (all free-tier):
   - "Include files outside the root directory in the Build Step" is
     Enabled. The lockfile (`package-lock.json`) and the root
     `package.json` live outside `frontend/`.
   - Install Command is the default. npm, run in `frontend/`, finds the
     workspace root and installs from the root lockfile. An override like
     `cd frontend && npm ci` would bypass that.
   - No custom Ignored Build Step that only diffs `frontend/`: a
     dependency change touches only the root lockfile, and must rebuild
     too.
5. Deploy.

## Environment variables

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | the Render backend's URL | The `NEXT_PUBLIC_` prefix is a Next.js convention — it makes the variable available in browser-side JavaScript, not just server-side code. Not a secret, so this is fine. |
| `NEXT_PUBLIC_SENTRY_DSN` | the `portfolio-frontend` Sentry project's DSN | Optional: error reporting is off when empty. Not a secret (a DSN can only submit events). See "Error reporting (Sentry)" below |

## Error reporting (Sentry)

Unhandled errors are reported from both sides: the browser
(`instrumentation-client.ts`) and the server, through Next's
`onRequestError` hook (`instrumentation.ts`), which covers Server
Components, Route Handlers, and Server Actions. Errors only: no tracing,
no Session Replay. The shared options and privacy rules are in
`frontend/lib/sentry.ts`, mirroring the backend: request bodies (contact
messages, the login password), cookies (`admin_session` holds the admin
JWT), headers other than User-Agent, IP addresses, and stack frame
variables are never sent. The browser drops its copy of a server error
(it has only a digest), so each server error counts once.

Environment and release are set by the SDK: the environment from
Vercel's `VERCEL_ENV` (`production` or `preview`), the release from the
deploy's commit SHA.

The free Developer plan (see `docs/render-runbook.md`) covers both
projects; the 5k errors a month are shared.

Setup:
1. sentry.io: create a second project with the Next.js platform, named
   `portfolio-frontend`. Copy its DSN (Settings > Projects > Client Keys).
2. Vercel: Settings > Environment Variables, add `NEXT_PUBLIC_SENTRY_DSN`
   for Production (and Preview if you want preview errors too). Don't
   use the Sentry integration from the Vercel Marketplace; a plain
   variable is all this needs. `NEXT_PUBLIC_` values are inlined at
   build time, so redeploy after adding or changing it.
3. Check it: in the browser console on the production site, run
   `setTimeout(() => { throw new Error("Sentry setup check") })`. It
   shows up under Issues within a minute, with environment `production`.

Not set up yet (both optional):
- Source maps. Without them, browser stack traces are minified. Uploading
  them needs a Sentry auth token as `SENTRY_AUTH_TOKEN`, plus
  `SENTRY_ORG` and `SENTRY_PROJECT`, on Vercel. `next.config.ts` already
  passes them to `withSentryConfig`; without a token the build skips the
  upload and still succeeds.
- `tunnelRoute`. Ad blockers drop some browser reports sent straight to
  sentry.io. A tunnel sends them through this site instead, at the cost
  of one Vercel function call per report.

## Production URL vs. preview URLs

Vercel gives every PR its own preview deployment at a unique
`*-git-<branch>-<project>.vercel.app`-style URL, separate from the stable
production URL (`the-portfolio-site-flax.vercel.app`). This matters for
CORS: Render's `ALLOWED_ORIGINS` is set to the production URL only (see
`docs/render-runbook.md`), so a **client-side** fetch from a PR preview deployment
would be blocked by the browser's CORS policy. Server-side fetches (the
home page and project detail page, both React Server Components) aren't
affected — CORS only governs requests made by JavaScript running in the
browser, and those pages fetch server-to-server. This will start to matter
for real once something client-side calls the API (the contact form, once
it has a UI).

Not a bug to fix now — just the expected behavior to recognize if a PR
preview's contact form submission fails with a CORS error while production
works fine.

## Things that only work with real internet access

`next/font/google` (used in `app/layout.tsx` for the Geist font family)
fetches and self-hosts the font files at build time. This requires the
build environment to reach `fonts.googleapis.com` — true for Vercel's own
build servers, not true in network-restricted environments (e.g. the
sandbox used while originally building this project, which could not
reach that domain). No action needed; noting it so a similar restriction
doesn't cause confusion elsewhere later.

## Rendering strategy

Public pages render per request (they read `searchParams` or call
`await connection()`), but their backend data comes from Next's data
cache (`unstable_cache`, tagged per resource in `lib/cache-tags.ts`).
On Vercel that cache is Runtime Cache: on Hobby, 1M reads and 200K
writes a month shared across the team's projects, kept across
deployments, one cache per region; running out pauses it for the rest of
the period at no charge (Vercel docs, checked 2026-11-10). A visit gets
the cached data at once; a stale entry refreshes in the background, and a
refresh that fails (Render asleep) keeps the old data. Admin saves mark
their tag stale with `revalidateTag(tag, "max")`, so the visit after a
save gets the old copy and the next one the edit. Edits made outside the
admin UI show within the 1-hour backstop. Nothing is prerendered at
build time, so the build never needs the backend.

Rejected: page-level ISR (`export const revalidate`), because the home
page reads `?stack=` and is dynamic anyway, and it would cache a
fallback page or need the backend at build; and `cacheComponents` /
`"use cache"`, whose default cache doesn't persist on serverless and
whose persistent variant (`"use cache: remote"`) is paid.

To check after a deploy: response times on a cold backend, and the
function logs for `revalidating cache with key` (a failed background
refresh, which Next logs but doesn't report to Sentry).