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

## Known issues

- Test row(s) in production `contact_messages`; delete when convenient.
- Seeded projects have `repo_url = null`; add real repository links.

## Next up (candidates, unordered)

- Admin UI for creating and editing projects, replacing curl/Swagger.
  Needs an auth decision first: the shared admin key can't safely live in
  browser JavaScript.
- Spam protection on `/contact` (honeypot field and/or rate limiting).
  The endpoint is public and unauthenticated.
- Notification when a contact message arrives. Messages are currently
  stored but nothing alerts anyone.
- Content pass on home page copy and the case studies.
- Playwright smoke tests against the deployed site; Sentry on both
  services.
- Allow Vercel preview origins in CORS if previews ever need client-side
  API calls.
- Switch to ISR (`revalidate`) if per-request rendering becomes costly.
