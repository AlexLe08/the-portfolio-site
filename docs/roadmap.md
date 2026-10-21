# Roadmap

## Done

- Backend: projects API (public reads, admin-key-protected create),
  contact endpoint, Alembic migrations, isolated in-memory SQLite tests.
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
- Webhook and length-limit tests. Backend suite is now 49 tests.
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
- `app/services/` layer: the Discord and email notifiers moved out of
  `routers/contact.py` into `services/notifications.py`. The router keeps
  HTTP concerns only (rate-limit dependency, honeypot, save, scheduling).
- `PATCH /projects/{slug}` (admin key): partial updates via
  `exclude_unset`, so production content can be edited through `/docs`
  instead of only created. Slug can't change (it's the URL); explicit
  `null` is only accepted for `repo_url`. Drafts are patchable, which is
  how a draft gets published. Backend suite is now 57 tests.
- `site_content` table (content pass, step 1): public `GET /content`
  returns a flat `{key: value}` map; admin-key `PUT /content/{key}`
  creates or replaces one value. Keys are lowercase dotted segments
  (`home.fact.location`), validated strictly because PUT creates keys.
  The migration itself seeds the current home-page copy and
  `site.description`, so production gets it on deploy without a shell.
  Backend suite is now 66 tests.

## Known issues

- Seeded projects have `repo_url = null`; add real repository links.

## Next up (candidates, unordered)

- Admin UI for creating and editing projects, replacing curl/Swagger.
  Needs an auth decision first: the shared admin key can't safely live in
  browser JavaScript.
- Content pass, in progress. Site copy moves out of code into the
  backend so text can change without a deploy (decision: our own
  `site_content` table, not a hosted CMS like Sanity or Contentful; the
  only editor is the owner, projects already live in Postgres, and the
  admin UI can edit both). Remaining steps:
  2. Frontend: pages read copy from `/content` with fallback text if the
     backend is cold or a key is missing; `generateMetadata` on project
     pages; contact page intro; GitHub and LinkedIn links.
  3. Content, applied through `/docs` (no deploy): case studies start at
     `##` (the page already renders the title as the only `<h1>`), real
     `repo_url`s, positioning line, optional third case study on this
     site itself. Facts come from the owner.
- Media library (after the content pass): images and other media stored
  as URLs, never as bytes in Postgres. A `media` table (url, required alt
  text, width, height, content type), an admin upload endpoint to object
  storage, and an upload screen in the admin UI. Until then, images work
  as markdown `![alt](url)` inside content values. Before choosing a
  storage provider, confirm its free tier needs no payment method; check
  `next/image` remote-image config in the bundled Next docs.
- Playwright smoke tests against the deployed site; Sentry on both
  services.
- Allow Vercel preview origins in CORS if previews ever need client-side
  API calls.
- Switch to ISR (`revalidate`) if per-request rendering becomes costly.
- Contact rate limiter follow-ups: it is in-memory, so it resets on restart
  or cold start and isn't shared across instances (move to the database or
  Redis only if the service ever scales out). `ContactForm`'s 429 message
  hard-codes "in an hour" and won't follow `CONTACT_RATE_WINDOW_SECONDS`;
  the backend's `Retry-After` header could drive the text instead.
- Verify a domain in Resend to email anyone other than yourself, and
  switch `EMAIL_FROM` to it.
