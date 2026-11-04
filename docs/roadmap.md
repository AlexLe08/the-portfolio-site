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
- Admin reads (admin UI, PR 3a): `GET /admin/projects` (drafts included,
  public display order) and `GET /admin/projects/{slug}`, returning
  `ProjectAdmin` (adds `published` and `sort_order`). The `/admin` router
  carries `require_admin` itself, so new admin routes are protected by
  default. Writes stay on `POST`/`PATCH /projects` and `PUT /content`.
  No deletion: unpublishing hides a project and can be undone. Backend
  suite is now 90 tests.
- Project editor (admin UI, PR 3b): `/admin` lists every project (order,
  title, slug, draft or published); `/admin/projects/new` and
  `/admin/projects/[slug]` share `ProjectForm`. All admin backend calls
  go through `adminApi()` (`lib/admin-api.ts`), which checks the session
  and adds the Bearer token. A `401` redirects to `/admin/login?expired=1`,
  which skips the signed-in redirect, because cookies can't be deleted
  while a page renders; the next login overwrites the cookie. The form
  submits through `onSubmit` + `startTransition`, not the `action` prop,
  because React resets a form after its action prop runs, even when the
  save is rejected. `app/admin/loading.tsx` and `error.tsx` cover cold
  starts and outages. With `loading.tsx` streaming the shell first,
  `redirect()` and `notFound()` complete in the browser and the 404 page
  is sent as `200`; acceptable for `noindex` admin pages. Verified end to
  end in headless Chrome against a seeded local backend.
- Site content editor (admin UI, PR 3c; admin UI complete):
  `/admin/content` has one form per key, matching `PUT /content/{key}`,
  so each save stands alone. It lists only the keys `lib/content.ts`
  reads, prefilling unsaved ones with their built-in text, and flags
  values that differ from that text, which shows during outages. It
  fetches `/content` directly, not through `getContent()`: that helper
  falls back to built-in text after 5 seconds, and saving a fallback
  shown during a cold start would overwrite real copy. Each key needs a
  description in a `Record<ContentKey, string>`, so a new key without
  one fails the build. Empty values are rejected (there's no delete).
- Slug validation on the backend: `ProjectCreate.slug` must match
  `SLUG_PATTERN` (lowercase words joined by single hyphens, the same rule
  as the admin form) and be at most 120 characters, matching the column.
  SQLite ignores `String(120)`, so an over-long slug used to pass tests
  and fail only on Postgres. Backend suite is now 100 tests.
- Refactor pass (no feature changes): project queries and their list
  order moved into `services/projects.py`; one `enforce_rate_limit()`
  for both 429s; `tests/helpers.py` for shared test helpers, and
  `conftest.py` now pins `ADMIN_API_KEY` (a real key in `.env` used to
  fail the suite). Frontend: `useSaveAction` + `SaveStatus` shared by
  both admin editors, `lib/project-rules.ts` for the slug rule and
  lengths, a shared "server unreachable" message, metadata title
  templates, and a `StackTags` component. One bug fix found on the way:
  `title` and `repo_url` had no `max_length` (same Postgres-only failure
  as the slug). Backend suite is now 104 tests. Verified in headless
  Chrome against a seeded local backend (titles, saves, rejected saves).
- ContactForm's 429 message follows the backend's `Retry-After` header
  ("try again in 12 minutes"), so it tracks `CONTACT_RATE_WINDOW_SECONDS`
  instead of hard-coding "in an hour". The form's fetch is cross-origin,
  and browsers hide non-safelisted response headers from JavaScript, so
  CORS now sets `expose_headers=["Retry-After"]`. Without it the header
  reads as `null` and the text falls back to "later". The four
  rate-limit settings are now `PositiveInt`: a limit of 0 used to crash
  the limiter on every request, and a window of 0 turned it off, so
  either now fails at startup. Backend suite is now 109 tests. Verified in headless Chrome against a local backend
  with a limit of 1 and a 600-second window ("in 10 minutes").
- Smoke tests against production: `/health` reports the running deploy's
  `commit` (`RENDER_GIT_COMMIT`), and Playwright tests in `frontend/e2e/`
  run from `smoke.yml` after each Vercel production deploy (waiting for
  the backend to match first), daily, and by hand. Not a required check.
  Details in `docs/ci-cd-runbook.md`.
- Dev scripts in `scripts/` for commands that were retyped every session:
  `setup-worktree.sh`, `check.sh` (pre-PR checks, one line per step),
  `gen-types.sh`, `local-stack.sh` (whole site on a throwaway seeded
  SQLite database, isolated from production whatever `.env` says), and
  `wait-for-backend.sh` (also used by `smoke.yml`). Listed in `CLAUDE.md`.
  Running the smoke tests against `local-stack.sh` caught one
  content-dependent assertion (a case study's own `#` heading made two
  `h1`s); the project test now reads the page header only.
- Sentry on the backend (step 1 of 2): unhandled errors are reported when
  `SENTRY_DSN` is set, tagged with the environment and deploy commit.
  The SDK's defaults would send request bodies (contact messages), stack
  frame locals (a `Settings` repr holds every secret), IPs, and cookies,
  so `data_collection` turns those off; tests send a crash through an
  in-memory transport and assert none of it, nor the admin key or a
  Bearer token, gets out. Errors only, no tracing yet. Backend suite is
  now 115 tests. Setup in `docs/render-runbook.md`.
- Sentry on the frontend (step 2 of 2): `@sentry/nextjs` reports browser
  errors and server errors (`onRequestError`) when
  `NEXT_PUBLIC_SENTRY_DSN` is set, in a separate `portfolio-frontend`
  project. Same privacy rules as the backend, in `lib/sentry.ts`: no
  bodies, cookies, IPs, frame variables, or headers besides User-Agent.
  The browser drops its digest-only copy of each server error, which
  would otherwise count twice. Verified locally against a fake Sentry
  server: a render crash, a Server Action crash with a password field,
  and a browser crash, each sent with an `admin_session` cookie, an
  admin key, and a forged IP; none of those values got out. No source
  maps or tunnel yet. Setup in `docs/vercel-runbook.md`. Verified in
  production on 2026-10-23: a test error from the live site reached
  Sentry.
- Stale database connections: Neon's free plan scales to zero after 5
  idle minutes (fixed) and closes open connections, so the first request
  after a quiet spell reused a dead pooled connection and returned 500.
  Sentry caught it on its first day (home page "Failed to load
  projects", backend `SSL connection has been closed unexpectedly`).
  The engine now sets `pool_pre_ping=True` (one tiny query per request).
  The new test closes a pooled connection the way Neon does, and fails
  without pre-ping. Backend suite is now 116 tests. Details in
  `docs/neon-runbook.md`. Deployed 2026-10-26 (`bc17818`); the home page
  loaded with no new Sentry errors. Confirmed 2026-10-27: a day of normal
  quiet spells passed with no new `OperationalError` in
  `portfolio-backend`.

- Public error boundary: `app/error.tsx` catches failures on the public
  pages (`/`, `/projects/[slug]`), which used to show Next's bare
  default error page. It mirrors `app/admin/error.tsx` (message plus a
  `retry()` button) and sits inside the root layout, so the site header
  stays. It doesn't report to Sentry: `onRequestError` already sends
  server errors. Also fixed: the project page turned any backend failure
  into a 404, so during an outage real projects looked deleted; now only
  a real 404 calls `notFound()` and anything else throws to the
  boundary. `/contact` can't fail on the backend (`getContent()` falls
  back). The home page has since been changed to degrade in place
  (next entry). Deployed 2026-10-26 (`41feae9`); the live
  pages return the expected codes (home and projects 200, unknown slug
  404). The error page itself was only exercised locally, against a
  stopped backend and one returning 500.

- Home page degrades in place when `/projects` fails (a 500 or an
  unreachable backend): the title block and intro still render, with a
  "Couldn't load projects" notice and a "Try again" link where the list
  goes, instead of the whole-page `app/error.tsx`. Because the failure is
  caught, `onRequestError` never sees it, so `loadProjects()` reports it
  to Sentry itself. The retry is a plain `<a href="/">` (full reload), not
  `<Link>`, whose same-URL behavior depends on the client router cache;
  that needs one `eslint-disable` for `no-html-link-for-pages`. No timeout
  on `/projects`: during a cold start the page still waits, because the
  projects do arrive. The degraded page is sent as `200`. Verified locally
  in headless Chrome against a fake backend (healthy, 500, connection
  dropped, then recovery via "Try again"), with a fake Sentry endpoint
  receiving both errors and none of the filtered data. Same PR (#38):
  project cards lost their underline and bullets. The card is the `<a>`,
  and a link's underline paints through all its text, so
  `text-decoration: none` has to sit on `.project-card`, not its children.
  Deployed 2026-10-26 (`ed01003`); smoke tests passed and the live home
  page lists projects. The degraded page only shows during an outage, so
  it has only been exercised locally.

- Media library (PR #40): `POST /media` (admin) uploads an image to
  Cloudinary and records a `media` row (url, `public_id`, required alt
  text, width, height, content type); `/admin/media` uploads and lists.
  Images are stored as URLs, never as bytes in Postgres. JPEG, PNG, WebP,
  GIF, and AVIF only (SVG can carry scripts), checked against the format
  Cloudinary reports, not just what the browser declares; width and
  height also come from Cloudinary. `public_id`s read as
  `portfolio/<alt-text-slug>-<random>`. `next/image` uses a Cloudinary
  `loaderFile` (`lib/cloudinary-loader.ts`), so Cloudinary resizes
  instead of Vercel's optimizer, whose Hobby quota is smaller.
  Provider decision (2026-10-26): Cloudinary, whose sign-up asked for no
  card. Free plan is 25 credits a month (1 credit = 1 GB stored, 1 GB
  delivered, or 1,000 transformations); what happens when credits run
  out isn't documented, so check usage before it matters. Storing
  `public_id` next to the URL makes a later move a re-upload plus URL
  rewrite. Runner-up: Vercel Blob (Hobby blocks Blob for 30 days at its
  1 GB limit). Ruled out: Supabase (free projects pause after a week
  idle), Cloudflare R2 (checkout flow; `r2.dev` is dev-only, needs a
  Cloudflare domain), UploadThing (JS-only), S3 (card).
  Upload path decision (2026-10-27): browser → Server Action →
  `POST /media` → Cloudinary SDK, capped at 4 MB because Vercel Functions
  reject request bodies over 4.5 MB. If larger files or video are ever
  needed: signed direct upload (the backend signs, the browser uploads
  straight to Cloudinary, then the backend records the row after
  re-checking the asset through Cloudinary's API; orphaned files from an
  abandoned second step need cleaning up). Deployed 2026-10-27
  (`845044a`); an upload verified in production by the owner.

- Settings validation: three more startup checks, next to the
  `JWT_SECRET` and `CLOUDINARY_URL` ones, for settings that used to fail
  silently or far from the cause. `ALLOWED_ORIGINS`: each entry must be
  exactly `scheme://host[:port]` (checked with `urlsplit`), because CORS
  compares origins exactly and a trailing slash silently blocked the
  contact form. `ADMIN_PASSWORD_HASH`: must parse with argon2's
  `extract_parameters()`, which catches quoted, `$`-expanded, and
  truncated pastes that a `$argon2` prefix check would miss; these used
  to be a 500 at login. `ADMIN_API_KEY`: with `ENVIRONMENT=production`,
  an empty key or the public `dev-only-change-me` default is refused (a
  `model_validator`, since it reads two fields). Decision recorded:
  reject a trailing slash instead of stripping it, so there is one rule
  and the typo gets noticed. `ENVIRONMENT` is now
  `Literal["development", "production"]`, so a typo like `prod` fails at
  startup instead of skipping the admin-key check; this beat flipping the
  check to fail closed, which would still leave a typo unreported and
  stray Sentry environment tags. The other settings already fail at startup
  (`DATABASE_URL`, `SENTRY_DSN`), are logged clearly at use (Discord,
  Resend), or accept any value. Backend suite is now 174 tests. Merged in
  two PRs (#41, then #42 for `ENVIRONMENT`); deployed 2026-10-27
  (`7d90c50`), and production started with its real settings.

- Media library follow-ups: `PATCH /media/{id}` edits alt text and
  `DELETE /media/{id}` removes an upload; `/admin/media` has a form and a
  Delete button (behind `confirm()`) per image. Alt text edits keep the
  `public_id`, because renaming it would change the URL already pasted
  into content; the slug in the Cloudinary name keeps the old wording.
  Delete refuses with 409 while project text (drafts included) or site
  content still contains the image's `public_id`, naming each place; the
  `public_id` rather than the URL, so resized Cloudinary URLs match too.
  The Cloudinary file goes before the row, so a Cloudinary failure (502)
  keeps the row for a retry; "not found" from Cloudinary counts as
  deleted, whether it arrives as a body or a `NotFound` error (the docs
  don't say which). The 409 is declared on the route (`ErrorDetail`) so
  the typed client knows its `detail`. Backend suite is now 191 tests.
  Edit, the 409, and the 503 were exercised in a browser on the local
  stack; a real Cloudinary delete verified in production by the owner
  (#43). Then: a Copy button beside each markdown line (Clipboard API,
  falling back to selecting the text), and a "Deleted" notice above the
  list, which takes focus because the deleted row takes its button with it.

- Startup errors no longer print setting values: `Settings` sets
  `hide_input_in_errors=True`. Pydantic's `input_value=...` printed the
  rejected value whatever its type (`SecretStr` too), shortened only to
  its first and last 25 characters. So a malformed `CLOUDINARY_URL` would
  have logged most of its API secret, a short `JWT_SECRET` all of it, and
  a missing production `ADMIN_API_KEY` (a model-level check) the ends of
  the whole settings dict, wherever other secrets fell. The earlier
  `CLOUDINARY_URL` test only passed because shortening happened to cut its
  secret out; the new test uses short secrets so that can't happen.
  This replaced the planned `ADMIN_PASSWORD_HASH` as `SecretStr`, which
  wouldn't have fixed the logs. Backend suite is now 195 tests.

- Distinct names for repeated controls. Buttons repeated on every row
  all read the same in a screen reader's list of buttons ("Delete,
  Delete, Delete"). WCAG most likely doesn't require unique names, so
  this is a usability fix. Each keeps its visible word and adds hidden
  text after it (allowed by 2.5.3 Label in Name, visible text first),
  through a new `.visually-hidden` class: "Save alt text for Team
  photo", "Copy markdown for Team photo", "Delete Team photo", the
  thumbnail link "Team photo (full size)", and "Save home.intro" on
  `/admin/content`. Hidden text beat `aria-label`, which replaces the
  visible text and is often skipped by auto-translation. Home page
  project cards were one link named by the title, summary, and every
  tag; now only the title (an `<h3>`, so heading navigation works) is a
  link, its `::after` stretches the click area over the card, and the
  focus ring moves to the card through `:has()` (the title keeps its own
  ring where `:has()` isn't supported). The cost: the summary can't be
  selected with the mouse. Names checked with Playwright accessibility
  snapshots on the demo stack.

- Backend test refactor (second refactor pass, step 2; tests only). The
  admin routes are now found through the OpenAPI schema:
  `require_admin` declares the Bearer and `X-Admin-Key` schemes, so every
  operation that depends on it lists `security`. A guard test fails when
  an operation outside `PUBLIC_OPERATIONS` (`tests/test_auth.py`) has
  none, and one parametrized test sends every admin operation no
  credentials, a wrong key, and a bad token, expecting 401 (a new admin
  route is covered automatically). This replaced 13 per-route tests.
  Rejected: walking `app.routes` for the dependency, because FastAPI
  0.162 keeps included routers in a private `_IncludedRouter`. Also:
  `contact_payload()`, `project_payload()`, and a fast argon2
  `PASSWORD_HASH` in `tests/helpers.py`; one `FakePost` for
  `httpx2.post` in `test_contact.py`; the settings-pinning fixtures
  merged into `pinned_settings`, the limiter resets into
  `fresh_rate_limits`. Backend suite is now 210 tests.
- Frontend lib and actions refactor (second refactor pass, step 3).
  `adminRequest()` (actions: null on a network failure, redirect on 401)
  and `adminLoad()` (pages: the data or a thrown error, optional
  not-found on 404) in `lib/admin-api.ts` replace the try/catch and 401
  handling repeated in 5 actions and 4 pages, keeping `redirect()` out of
  every `try`. `formText()` in `lib/form-data.ts`; `checkAltText()`,
  the format list (`Intl.ListFormat`), and the 4 MB text built from
  `lib/media-rules.ts`; `describeRetryAfter()` and
  `describeSaveFailure()` in `lib/messages.ts`. Behavior changes: content
  and alt-text saves show 422 field details, the login 429 reads like
  the contact form's ("in 10 minutes", "in about an hour"), and the
  contact form's unreachable text drops "please". Verified with
  Playwright on the demo stack (saves, a 422, server checks, backend
  down, stale token, both 429s). Found on the way: the demo stack and
  `local-stack.sh` didn't blank `CLOUDINARY_URL`, so a test upload
  reached the real Cloudinary account; both now blank it (uploads get
  the 503 "not configured" message).
- Frontend components and CSS refactor (second refactor pass, step 4 of
  4, which completes it; no visual changes). `components/Sheet.tsx`
  frames every page (sheet, back link, ruled header; named after the
  `.sheet` class rather than `Page`, which reads like a `page.tsx`
  route), and `components/StatusMessage.tsx` replaces 15 hand-written
  `form-status` divs, deriving the ARIA role from the tone. Three inline
  margins became classes (`home-intro`, `contact-intro`,
  `contact-elsewhere`). In `globals.css`, the sheet and the site header
  share one width rule (they must line up), and the page-title,
  stack-row, and narrow-screen title-block rules are merged; a
  `.form-button:focus-visible` that repeated the global ring is gone.
  Verified by 21 before/after screenshots (public pages at 1280 and 390
  wide, every admin page, each status message, backend-down pages),
  identical byte for byte, plus computed focus rings. Not extracted: a
  `FormField` wrapper or `SubmitButton` (the fields differ too much),
  and a shared `ErrorNotice` (see below).
- Home page character sheet, a panel modelled on an RPG equipment screen
  (`components/character-sheet/`). Jobs are the target industries, slots
  are résumé sections, and the panel sits above the title block. The layout
  is:
  - a title bar with the job menu;
  - a header with one slot either side of the level and job title;
  - 6 slots in each column, with rails along the outer edge;
  - a portrait filling the space between the columns, with an optional
    corner badge.

  Tooltips are compact item cards: tags, a title, a stat line, and items as
  plain lines or label/value pairs. Unfilled slots render as dimmed
  squares. Each slot
  shows a tooltip on hover or keyboard focus, and Escape dismisses it.
  Clicking a slot goes to a page section, another page, or an external
  site. "Change job" is a `<details>` menu of `?job=` links, so it works
  without JavaScript, links can be shared, and the back button works; an
  unknown `?job=` falls back to the default job. The Summary, Skills, and
  Experience sections below the panel change with the job.
  - Content lives in `lib/character-config.json` and is validated by a
    zod schema (`schema.ts`). `lib/character.ts` fails the build on any
    problem. `npm run generate:character-schema` writes a JSON Schema for
    editor autocomplete.
  - The module imports nothing from the site: the host passes its link and
    image components, and the CSS uses `--cs-*` variables.
  - There are two themes, `document` (the site's tokens) and `game`. Both
    are shown, unlinked and noindexed, at `/lab/character-sheet`.
  - `parseConfig` and `loadConfig` are ready for remote sources: invalid
    jobs are dropped, and a source that fails falls back to the next one,
    ending at the bundled file.
- Character sheet storage on the backend (the first of three PRs for admin
  editing; nothing reads it yet). A single-row `character_sheet` table
  holds the whole config as one JSON document (`JSON`, not `JSONB`, so key
  order survives raw editing; `CHECK (id = 1)` and no id sequence). Public
  `GET /character-sheet` (404 until the first save) and admin `PUT`, which
  checks the document against the JSON Schema generated from zod
  (`jsonschema`), so the rules live only in `schema.ts`. 422 items use
  FastAPI's `{loc, msg, type}` shape, with the full path into the document;
  a failed slot action is explained from the branch its `kind` selects.
  `generate:character-schema` copies the schema to the backend, and a test
  fails if the copies differ. Found on the way: `z.url`'s protocol rule
  didn't reach the JSON Schema, so it accepted `javascript:` links; a
  `.regex()` now exports as a `pattern`. Typed as `dict[str, JsonValue]`,
  not `Any`. Migration checked on Postgres 16 and SQLite. Also:
  `@contextmanager` functions return `Generator[None, None, None]`
  (typeshed deprecates `Iterator` there). Backend suite is now 238 tests.
  Deployed: production ran the migration, `GET /character-sheet` answers
  404 "No character sheet saved yet", and an unauthenticated `PUT` is 401.
- The home page reads the saved character sheet (admin editing, PR 2a):
  `getCharacterConfig()` in `lib/character.ts` runs
  `loadConfig([apiSource], bundled)`, in the page's existing
  `Promise.all`, with a 5-second timeout like `getContent()`. A source's
  `load()` may now resolve to `undefined` ("nothing here yet"), which
  `loadConfig` skips without an issue; the 404 before the first save
  uses it, so it's in the module rather than this site's glue. Reported
  to Sentry: HTTP errors and saved copies that fail zod (a dropped job
  lists its path). Only logged: timeouts and an unreachable backend,
  which every cold start would otherwise report. `/lab/character-sheet`
  loads the same way, so it keeps matching the home page. Verified locally: no save (bundled, no
  event), a valid save (shown), a job made invalid in the database
  (dropped, one event with `jobs.1.level`), backend stopped (bundled,
  only `loadProjects`' existing event), and a 500 from a fake backend
  (bundled, one event). The timeout itself wasn't exercised; it takes the
  same `catch` as the unreachable backend.
- Character sheet editor (admin editing, PR 2b): `/admin/character-sheet`
  edits the whole config as raw JSON in a textarea, matching
  `PUT /character-sheet`. The Server Action runs `parseConfig` strictly
  (any problem blocks the save, each listed by path inside the alert), the
  same rule as the bundled file's build check, because the backend's JSON
  Schema can't see duplicate ids, a job naming an unknown slot, or a
  `defaultJobId` with no job. It sends the document as written, not zod's
  output, which would drop unknown keys. Backend 422s show their full path
  after `config`, not only the last segment. The page starts from the
  bundled file only on a 404; any other load failure shows
  `app/admin/error.tsx`, so a cold start can't prefill a fallback that
  would then be saved over the real copy. A note says when the saved copy
  differs from `lib/character-config.json`, which shows during outages.
  Unknown keys (typos like `subtitel`) are saved but listed as likely
  typos, after each save and on load. `findUnknownKeys` in
  `components/character-sheet/parse.ts` compares the raw document with
  zod's output, since `z.object` strips keys it doesn't know; that follows
  union branches with no second copy of the schema. Rejected: deep-strict
  zod schemas (a second copy of every object) and walking the JSON Schema
  (a second validator). Warn rather than block, because a typo in a
  required field already fails as missing, so only optional fields can
  slip through, and the site just leaves them out. The bundled
  `lib/character-config.json` is held to more: an unknown key there fails
  the build, like its other problems.
  Rejected: CodeMirror or Monaco (weight; PR 3's form is the real UX
  upgrade) and checking in the browser too (a second code path for one
  editor). Verified with Playwright on the demo stack: first load, invalid
  JSON, cross-field problems (nothing sent), a save shown on the home page,
  reload, and the backend down on save (edit kept) and on load. Not
  exercised: a backend 422 or 413, which zod and the size cap make hard to
  reach from the form. Merged as #56 and deployed 2026-11-04 (`8343d8d`);
  the production smoke tests passed. A save through the editor hasn't
  been verified in production yet.
- Character sheet form (admin editing, PR 3): `/admin/character-sheet` is
  now a form for one job at a time (`?job=`, like the home page): name,
  title, icon, level, portrait (URL, alt, framing), and one markdown
  section per slot, with empty slots folded into a `<details>`. The raw
  editor moved to `/admin/character-sheet/json` for everything else
  (slots, tooltips, actions, adding jobs). `updateCharacterJob` re-reads
  the saved copy at save time and writes only the form's fields into that
  job, so other jobs, unknown keys, and a JSON edit made since the form
  loaded are kept; both editors then save through the same `saveConfig`
  (strict `parseConfig`, then `PUT`). Like the page, only a 404 starts
  from the bundled file; any other failed read refuses to save. Empty
  optional fields remove their key; a new portrait URL drops the old
  `width`/`height`; section line endings are normalized to `\n` (the
  browser sends `\r\n`), so an unchanged section doesn't read as
  differing from the bundled file. Input `maxLength`s are read from the
  zod schema on the server (`.maxLength`), so zod stays out of the
  browser bundle. A saved copy with problems shows them and links to the
  JSON editor instead of the form, since no form save could pass.
  Rejected: editing the whole document in the browser (a save could
  overwrite edits made since the page loaded) and a backend `PATCH`
  (backend work and partial validation for a single admin). Verified
  with Playwright on the demo stack: first load, a JSON edit in another
  tab kept by a later form save, title/icon/section edits shown on the
  home page, switching jobs, a portrait added then removed, an empty
  title past the browser's check (listed as `jobs.1.title`, nothing
  saved), and the backend down on save (edit kept).

## Next up (candidates, unordered)

- Character sheet follow-ups, roughly in order:
  - A real portrait. Upload it at `/admin/media` and set `portrait` on each
    job in `lib/character-config.json` (`framing: "face"` or `"full"`).
  - More jobs, such as AI development, plus slots like Education.
  - Admin editing, PR 3b: slot tooltips in the form (title, subtitle,
    note, stat; `items` mixes strings and label/value pairs, so it needs
    its own small list editor).
  - Unknown keys (typos like `subtitel`) pass both zod, which strips them,
    and the backend. Strict zod objects would reject them in both places,
    but the lenient read would then drop a whole job over one stray key.
    Decide before content comes from a CMS. The admin editor already warns
    about them (`findUnknownKeys`), and a CMS adapter could do the same.
  - Slot actions that change the current page (for example filtering the
    project list), which need a small client bridge.
  - Extraction to its own repository as a React package: core, themes,
    schema, `loadConfig`, CMS adapters (Contentful first, on its free plan;
    the core never imports a CMS SDK), and a demo site. A custom-element
    wrapper only if someone asks for one. Backend code stays out of it
    (decided with PR #54): the package ships the JSON Schema as the
    contract, which any backend can validate against in its own language,
    and this site's FastAPI storage stays here as one example of a backend
    using it. The schema gets a versioned `$id`, and `backend/` then copies
    it from the installed package instead of the frontend folder. A Python
    validator package (`find_issues` and its `oneOf` explanation) only if
    someone asks, and then in the same repository, so it ships with the
    schema version it checks.

- Shared error UI, only when a third segment boundary appears or the
  error UI grows past a message and a "Try again" button (a back link, a
  reference ID): extract `components/ErrorNotice.tsx` (`message`,
  `retry`) from `app/error.tsx` and `app/admin/error.tsx`, which
  currently differ only in their sentence. `app/global-error.tsx` stays
  separate (own `<html>`, styles, Sentry).

- Project deletion, only if unpublishing ever stops being enough.
- Content follow-up, doable at `/admin/projects`: `repo_url`s for other
  repositories as they go public.
- Every secret setting as `SecretStr` (`JWT_SECRET`, `ADMIN_API_KEY`,
  `ADMIN_PASSWORD_HASH`, `DATABASE_URL`, `RESEND_API_KEY`,
  `DISCORD_WEBHOOK_URL`), only if settings ever get printed: `SecretStr`
  masks `repr()` (e.g. a frame's locals in a Sentry event) but not
  validation errors, which `hide_input_in_errors` already covers. Each
  read becomes `.get_secret_value()`.
- Sentry follow-ups: frontend source maps (needs `SENTRY_AUTH_TOKEN` on
  Vercel) once a minified browser stack trace gets in the way. Tracing
  on either service only if errors alone stop being enough.
- Allow Vercel preview origins in CORS if previews ever need client-side
  API calls.
- Switch to ISR (`revalidate`) if per-request rendering becomes costly.
- Contact rate limiter follow-up: it is in-memory, so it resets on restart
  or cold start and isn't shared across instances (move to the database or
  Redis only if the service ever scales out).
- Verify a domain in Resend to email anyone other than yourself, and
  switch `EMAIL_FROM` to it.
