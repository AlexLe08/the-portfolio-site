# Roadmap

## Done

- Backend: projects API (public reads, admin-key-protected create),
  contact endpoint, Alembic migrations, 10 isolated tests.
- Frontend: home page, project detail pages rendering markdown case
  studies, contact form; typed API client generated from OpenAPI.
- Deployment: Render (backend), Neon (Postgres), Vercel (frontend), all
  on free tiers with no payment method on file.
- CI: two required checks on `main` via a branch ruleset.
- Visual design pass, shared site header, runbooks for every service.
- ContactForm handles network failures: `api.POST` throws when the backend
  is unreachable or CORS blocks the request, so the call is wrapped in
  try/catch and shows a "may be waking up" error (Render free-tier cold
  starts take 30–50 seconds).
- Contact messages post to a Discord channel via webhook (one embed per
  message, mentions disabled, runs as a background task so it never slows
  or fails the request). Optional via `DISCORD_WEBHOOK_URL`; failures are
  logged, not retried.
- `/contact` length limits: name 1–200, message 1–4000 characters (4000
  keeps the message inside Discord's 4096-character embed description).
  ContactForm builds specific error text from the backend's 422 detail.
- Webhook and length-limit tests (22 backend tests total).
- Email notification via Resend's HTTP API (SMTP is blocked on Render's
  free tier), with `reply_to` set to the visitor. Added because Cloudflare
  blocks Discord requests from Render's shared outbound IP
  (`HTTP 429 ... Cloudflare ... restrict access`). The Discord code stays,
  in case a dedicated IP (paid Render plan) ever makes it reliable.
- Tests can no longer send real notifications: `conftest.py` blanks the
  Discord and Resend settings for every test.
- Spam protection on `/contact`: a honeypot field (tripped submissions get a
  fake `201`, nothing saved or sent) and an in-memory per-visitor rate limit
  (5 per hour, `429` after that), keyed on `CF-Connecting-IP` via
  `CLIENT_IP_HEADER`. Verified in production, including that separate
  networks get separate limits.

## Known issues

- Test row in production `contact_messages` (the 2026-10-21 rate-limit
  check); delete when convenient.
- Seeded projects have `repo_url = null`; add real repository links.

## Next up (candidates, unordered)

- Admin UI for creating and editing projects, replacing curl/Swagger.
  Needs an auth decision first: the shared admin key can't safely live in
  browser JavaScript.
- Content pass on home page copy and the case studies.
- Playwright smoke tests against the deployed site; Sentry on both
  services.
- Allow Vercel preview origins in CORS if previews ever need client-side
  API calls.
- Switch to ISR (`revalidate`) if per-request rendering becomes costly.
- Extract a `services/` layer for notifications. `routers/contact.py` now
  holds two notifiers plus shared error logging; moving them out would
  match the rule in CLAUDE.md.
- Verify a domain in Resend to email anyone other than yourself, and
  switch `EMAIL_FROM` to it.
