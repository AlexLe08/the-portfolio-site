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
- Frontend reads site copy (content pass, step 2a): `lib/content.ts`
  fetches `/content` once per request (`React.cache`) and merges it over
  built-in fallbacks, giving up after 5 seconds so a cold backend never
  holds a page. `*.intro` keys render as markdown, other keys as plain
  text. Home and contact pages read it (contact is now `force-dynamic`);
  project pages have `generateMetadata` (title and summary). Only keys
  listed in the fallbacks are read, so a new key needs a code change.
- GitHub and LinkedIn links (content pass, step 2b) in the site header
  and on the contact page. The URLs live in `lib/links.ts`, not
  `site_content`: the header renders from the root layout, and reading
  `/content` there would put a backend call on every route.
- Real `repo_url`s on both seeded projects, and their case studies no
  longer open with a duplicate `#` heading (applied through PATCH).
- Project order: a `sort_order` column (lowest first, `id` breaks ties),
  settable on create and through PATCH. The list previously had no
  `ORDER BY`, so Postgres could reorder it after any update. Values go
  in steps of 10 so a project can slot in without renumbering the rest.
  Backend suite is now 68 tests.
- Content pass complete (step 3 applied through the admin API, no
  deploy): positioning line (`home.role`), `home.intro` updated for
  three projects, and a case study on this site itself (`portfolio-site`)
  shown first. Order: `portfolio-site` 10, `enterprise-search-input` 20,
  `discord-reminder-bot` 30. The fallbacks in `lib/content.ts` were
  updated to match. Decision recorded: site copy lives in our own
  `site_content` table, not a hosted CMS like Sanity or Contentful; the
  only editor is the owner, projects already live in Postgres, and the
  admin UI can edit both.

- Admin login (admin UI, PR 1 of 3): `POST /auth/login` checks a password
  against an argon2 hash (`ADMIN_PASSWORD_HASH`) and returns a JWT signed
  with `JWT_SECRET` (8-hour default). Admin endpoints accept that token as
  `Authorization: Bearer` or the existing `X-Admin-Key`; a request with
  neither is now `401`, not `422`. One shared login rate limit (5 per 15
  minutes). `/docs` has an Authorize button. Backend suite is now 83 tests.
  Decision recorded: FastAPI owns login and Next.js acts as a
  backend-for-frontend, holding the token in an httpOnly cookie on its own
  domain. Rejected: Next-only password auth (puts the security logic in
  the frontend, and Vercel functions can't share a rate limiter); cookies
  set by the backend (`vercel.app` to `onrender.com` is cross-site, so
  Safari blocks them); tokens in `localStorage` (readable by any injected
  script). GitHub login is a later upgrade that replaces only the
  password check.

- Admin login on the frontend (admin UI, PR 2 of 3): `/admin/login` posts
  to a `login` Server Action, which calls `POST /auth/login` from Vercel's
  server and stores the JWT in an httpOnly, `SameSite=strict` cookie
  scoped to `/admin` that expires with the token. `/admin` is a
  placeholder with sign out. Admin pages are `noindex`. Vercel Hobby
  functions run up to 300s (Fluid compute, on by default), so the action
  waits up to 60s for a Render cold start. Decision recorded: the
  frontend never checks the JWT signature, which would put `JWT_SECRET`
  on Vercel too. A cookie only decides what to render; the backend
  checks the token on every admin request, so Vercel holds no secrets.
  Verified end to end in headless Chrome against a local backend.

## Next up (candidates, unordered)

- Admin UI, PR 3: screens for editing projects, then site content. Needs
  an admin-only backend read that includes drafts (the public list hides
  them), and one helper for admin backend calls that adds the Bearer
  token and, on a `401`, deletes the cookie and redirects to login.
- Content follow-ups: the owner's own `contact.intro` (the current text
  was drafted by Claude), and `repo_url`s for other repositories as they
  go public. After any `PUT /content/{key}`, update the matching fallback
  in `lib/content.ts`.
- Media library: images and other media stored
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
