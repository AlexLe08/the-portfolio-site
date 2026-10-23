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
4. Deploy.

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

Both data-fetching pages (`app/page.tsx`, `app/projects/[slug]/page.tsx`)
set `export const dynamic = "force-dynamic"`, meaning they're rendered
per-request rather than statically built once. This is deliberate:
project data can change at any time via the backend's admin API, so a
build-time snapshot would go stale. The cost is one real backend request
per page visit; see the comment in `app/page.tsx` for the ISR
(`export const revalidate = N`) middle ground if that cost ever matters.