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
   URL (e.g. `https://portfolio-backend.onrender.com`, no trailing slash).
4. Deploy.

## Environment variables

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | the Render backend's URL | The `NEXT_PUBLIC_` prefix is a Next.js convention — it makes the variable available in browser-side JavaScript, not just server-side code. Not a secret, so this is fine. |

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