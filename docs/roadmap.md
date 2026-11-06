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
  saved), and the backend down on save (edit kept). Merged as #57 and
  deployed 2026-11-04 (`74d092f`); editing jobs through the form was
  confirmed working in production.
- Portrait picker: the form's portrait is picked from the uploads at
  `/admin/media` (thumbnail grid, newest first), a pasted URL, or none,
  all one radio group (`components/PortraitPicker.tsx`). It submits the
  same `portrait_src` field the URL input did, so `updateCharacterJob` is
  unchanged. Picking an upload fills in its alt text unless the alt text
  was written by hand. The page loads uploads with `adminRequest`, so a
  failed media list leaves the URL option working instead of showing the
  error page. Rejected: a `<select>` (no thumbnails) and a modal gallery
  (focus trapping for a handful of images). The demo stack now returns
  `dbPath`, so demo scripts can insert media rows (uploads are off
  there). Verified with Playwright on the demo stack (11 asserted steps,
  inline-SVG uploads, so Cloudinary thumbnails weren't exercised). Merged
  as #58 and deployed 2026-11-04 (`85aafbd`); not yet tried in production.
- Media delete guard for portraits: `find_usages` also searches the
  stored character sheet, so deleting an image a job still uses is a 409
  naming the job ("character sheet job healthcare"; plain "character
  sheet" for a match outside `jobs`). The one row is searched in Python,
  each job's JSON as text, rather than with a SQL cast to text, which could
  only say "character sheet". Still a text search, so resized URLs and an
  image anywhere in a job count. Not covered: the frontend's bundled
  `lib/character-config.json`, which the backend can't see, so an image
  copied there can still be deleted. Mutation-checked (6 of 6 caught).
  Merged as #59 and deployed 2026-11-04 (`61fce97`).
- Real portrait: the avatar uploaded at `/admin/media`
  (`portfolio/lami-s-avatar-sticker-910fc625e091`) is picked for both
  jobs in production, and copied into `lib/character-config.json`
  (`framing: "face"`) so outages show it too. Only the portraits were
  copied; production's other differences from the bundled file were left
  alone. The delete guard doesn't see the bundled copy, so don't delete
  that upload. Merged as #60 (`20ddd96`).

- Fallback notice: when a load fails (backend unreachable or past the
  5-second timeout, an HTTP error, or a saved character sheet that fails
  the schema), the home, contact, and `/lab/character-sheet` pages show
  one plain `StatusMessage` (tone `info`) at the top through `Sheet`'s new
  `notice` slot: "Parts of this page show built-in content because the
  latest couldn't be loaded." While it retries it adds "Trying again in
  the background; the page will update on its own."; only after the last
  retry fails does it ask for a reload. `AutoRetry`, a client provider
  each page wraps around its `Sheet` (`active` when anything failed),
  calls `router.refresh()` after 3, 10, 20, and 30 seconds: the server
  renders the page again and the result merges in place (no reload; typed
  form input and scroll position stay), so a successful retry removes the
  notice and swaps in the saved values and the project list. It pauses
  while the tab is hidden and retries at once when it's shown again.
  `FallbackNotice` and `ProjectsUnavailable` read whether it gave up
  (`useRetriesGaveUp()`): the project list's message is a plain "trying
  again" line until then, and only after giving up becomes an error with
  the Try again button. A failure of only the project list retries too
  (no notice). Rejected: hiding the button only while the notice shows
  (a failure of only the project list would still get the manual button)
  and pausing a hidden tab's wait to resume it later (someone returning
  after minutes would wait up to 30 more seconds). Known gap: attempts
  aren't reset if a page recovers and then fails again without a
  navigation, so it gives up sooner then. On a cold start the first retry usually succeeds:
  `/projects` has no timeout, so the page already waited for the backend
  to wake. Rejected for retrying: fetching the content in the browser
  (client components and zod in the bundle, duplicated loaders) and
  holding a streamed response open until the backend answers (a Vercel
  function open for up to a minute per visit). Not shown for "nothing saved" (a 404, a key with no saved
  value), where the built-in value is current. `getContent()` returns
  `{ content, fallback }` and now treats an HTTP error as a fallback
  (reported to Sentry; before, it quietly merged nothing).
  `getCharacterConfig()` returns `{ config, fallback }`. The package's
  `loadConfig(sources, fallback)` now resolves to `{ config, source,
  issues }` (`source` null for the fallback) instead of taking an
  `onIssue` callback, and a source throws when it fails rather than
  resolving to `undefined`, which now only means "nothing saved"; the
  host throws a `BackendUnavailable` for an unreachable backend and keeps
  it out of Sentry. The project list keeps its own error message: it has
  no built-in copy and can fail while content loads. Rejected: a fixed
  ribbon or corner badge (covers content; decorative), a sticky bar
  (holds screen space all visit), and a request-scoped side channel for
  the flag (call sites could miss it). Verified with Playwright on the
  demo stack (9 asserted steps: backend up, down on home and contact,
  back up, an invalid saved character sheet, and a fake backend answering
  500; then 12 more for retrying: recovery on contact with typed input
  kept and no reload, recovery on home with the project list,
  giving up after 63 seconds with the button appearing only then, a
  failure of only `/projects` recovering on its own, and a hidden tab
  making no refreshes for 20 seconds, then one at once when shown).
- Adding a job from the form: "Add a job" on `/admin/character-sheet`
  (`components/CharacterJobAddForm.tsx`, folded in a `<details>`) takes
  an id, name, and title and copies an existing job (level, portrait,
  slots, sections; the current job is preselected), since jobs share
  most slots. `addCharacterJob` re-reads the saved copy like
  `updateCharacterJob`, refuses an id that exists, saves through
  `saveConfig`, then redirects to the new job's form. The job is live as
  soon as it's added. Rejected: a blank job (level is required and
  tooltips are JSON-only, so it would start as an empty panel) and a
  separate `/new` page. Found on the way: browsers compile an HTML
  `pattern` with the `v` flag, where the bare `-` in `[a-z0-9-]` is a
  syntax error and the attribute is silently ignored, so `ID_PATTERN`
  now escapes it (`\-`, same meaning in zod, the JSON Schema, and
  Python's `re`; the schema copies changed by that character only).
  Verified with Playwright on the demo stack (7 asserted steps: the id
  pattern blocking "AI Dev", an existing id refused with input kept, the
  backend down on add, a copy of E-commerce opening in the form, editing
  it, and the home page showing it with E-commerce unchanged). Merged as
  #63 (`0962859`) on 2026-11-05. Confirmed working in production the
  same day: a Teacher job was added through the form and some of its
  sections filled in.
- Slot tooltips in the job form (admin editing, PR 3b): filled slots'
  tooltips (`components/SlotTooltipFields.tsx`), one closed `<details>`
  per slot, saved by the job form's one Save. Items are rows with an
  optional label (empty: a plain line), add/remove/up/down, sent as
  repeated `item_label`/`item_value` fields paired by position. Only
  slots the saved copy still fills are written, over the saved tooltip
  (unknown keys kept); a half-filled stat or item is written as is so
  the save names the missing half. Rejected: a form per slot (edits in
  other slots lost on leaving) and one textarea with `Label: value`
  lines (ambiguous with colons in plain lines). Verified with
  Playwright on the demo stack (7 steps: an untouched save stores the
  bundled file exactly; edit, reorder, remove; reload; home page
  tooltip; half a stat refused by path; an emptied title in a closed
  `<details>` reopens it). Merged as #64 (`b6c3272`) on
  2026-11-05 and deployed (Vercel); not yet tried in production.
- Slot actions and filling empty slots in the job form (admin editing,
  PR 3c): an action picker per slot
  (`components/SlotActionFields.tsx`: none, anchor, link, external
  with a new-tab box; only the chosen kind's inputs render, so only
  they submit; anchors suggest the job's section ids plus `projects`
  through a `<datalist>`; a leading # is stripped), and a Fill button
  per empty slot that adds the same fields, open and focused, with
  "Don't fill" to undo before saving. A kept kind keeps the saved
  action's other keys; a changed kind starts clean. New slots send a
  hidden `fill` field; if the saved copy fills that slot by save time,
  the save is refused ("reload") rather than either copy winning.
  `updateCharacterJob` calls `refresh()` after a save so a just-filled
  slot counts as filled (otherwise the next save would resend `fill`
  and be refused). Rejected: always-rendered fields for every empty
  slot (no `required` title, doubles the form). Verified with
  Playwright on the demo stack (10 steps: untouched save stores the
  bundled file exactly; new tab; fill with focus and a `#` target;
  refreshed to filled; second save; Don't fill; kind change drops
  `href`; empty path in a closed `<details>` reopens it; bad path
  refused by path; home page link; fill conflict refused). Merged as
  #65 (`91004ae`) on 2026-11-05 and deployed (Vercel, 21:08 UTC); not
  yet tried in production.
- `parseConfig` no longer adds `defaultJobId: no valid job ...` when the
  default job was dropped for its own errors (a rejected save listed the
  same problem twice). It remembers dropped jobs' ids and skips only that
  follow-on line; a `defaultJobId` typo is still reported, even beside an
  unrelated broken job. The lenient read still falls back to the first
  job, its log now without the `using "..."` note. Rejected: skipping the
  line whenever any job has errors (hides a real typo); filtering it in
  `saveConfig` (the build check and admin load would keep the noise).
  Checked with a throwaway Node script on the bundled file (default job
  broken, typo, typo plus another broken job). Merged as #66
  (`f4d48f2`).
- Agent workflow (#67): the main session orchestrates and delegates to
  four project subagents in `.claude/agents/`. `planner` (read-only)
  writes the plan; `backend-implementer` and `frontend-implementer` each
  work in a worktree from `scripts/new-worktree.sh`, commit, and push;
  `reviewer` (read-only) reports `path:line` findings before the PR.
  Rules are in CLAUDE.md "Agent workflow", which subagents load; the
  agent files point there instead of copying rules. Agents may commit
  and push task branches; only the owner approves and merges. Scope
  enforcement: a `PreToolUse` hook in each implementer's frontmatter
  (`.claude/hooks/scope-edits.py`) denies Edit/Write outside its
  directory of a task worktree; Bash writes aren't seen, so the reviewer
  checks the diff's paths too. `.claude/settings.json` denies reading or
  editing `.env`/`.env.local`, force pushes, and `gh pr merge`/`review`,
  and asks before smoke tests, `wait-for-backend.sh`, and `curl` to the
  production hosts. Rejected: `isolation: worktree` in frontmatter (skips
  the branch naming, `--no-track`, and `setup-worktree.sh`), and
  session-wide `Edit` deny rules for scope (they can't differ per agent).
  Found on the way: the main checkout's backend venv was stale
  (FastAPI 0.141, SQLAlchemy 2.0, no `jsonschema`), because
  `pip install -e` never upgrades installed packages; rebuilt, and
  CLAUDE.md now says to rebuild when local results differ from CI.
  Backend suite is 240 tests. The hook was tested on 11 sample inputs;
  the agents, hook, and deny rules haven't run live yet (they load in a
  session started after the merge). The pilot ran on the next item.
- Emptying a filled slot from the job form (#69, the agent workflow's
  first pilot: planner, then frontend-implementer, then reviewer). Each
  saved slot gets an "Empty {label}" button; while marked, the slot shows
  "emptied on save", a hidden `empty` field, and "Keep {label}" to undo,
  with no fields rendered (so the `required` title can't block the
  save). `applyJobForm` deletes `empty` ids before any merge, refuses an
  id sent as both `fill` and `empty`, and ignores ids the saved copy no
  longer fills. Emptying keeps the slot's page section (owner decision:
  they're stored and rendered separately). No confirm dialog: Keep
  undoes until Save. Keep restores the saved values, so edits made
  before Empty are lost (accepted). Also fixed: `filling` was never
  cleared, so fill, save, empty, save re-sent `fill`; both lists are now
  pruned against `job.slots` when it changes after a save. Rejected:
  all-blank fields mean empty (a cleared title would silently delete),
  a checkbox per slot (fields still render), and a schema change (a
  missing key already means empty). Verified with Playwright on the
  demo stack (7 steps: stored copy loses only that key and keeps the
  section; home page empty slot; refreshed to the Fill button; fill,
  save, empty, save stays empty, and fails with the prune removed;
  Empty then Keep stores the bundled file exactly; cleared title then
  Empty saves; backend down keeps the state). Merged as #69
  (`87fd6e9`) on 2026-11-05; not yet tried in production.

- CLAUDE.md wording fixes from the agent workflow setup and the #69
  pilot (docs only): the `paths:` rule now names the `pull_request`
  trigger (the `push: main` filters are fine); `core/rate_limit.py` and
  `services/character_sheet.py` are in the layer descriptions. "Agent
  workflow" now says what to expect: `EnterWorktree` may refuse a task
  worktree when the session started at the repo root, so agents use
  absolute paths (step 1 of each agent file points there). The scope
  hook now also allows the worktree's root `.logs/` (gitignored), so
  demo scripts sit next to the videos and screenshots they produce
  instead of in `frontend/.logs/`. Checked on 11 sample paths: `..`
  escapes, the main checkout's `.logs/`, and other directories are still
  denied. Merged as #71 (`bc138fd`).
- Removing a job from the form (#72; planner, frontend-implementer, and
  reviewer, the second agent-workflow run): "Remove this job"
  (`components/CharacterJobRemoveForm.tsx`, folded in a `<details>`
  like "Add a job") on the job being edited, behind a `confirm()` that
  names the job and suggests copying its JSON first. It saves at once
  and lands on `?removed=<id>`, the default job's form with "Removed
  the job …" (shown only when the id matches `ID_PATTERN` and is no
  longer a job, so a stale link can't claim a removal).
  `removeCharacterJob` re-reads the saved copy at save time: the default
  job is refused, with a note linking to the JSON editor, which also
  keeps the last job (always the default); a job already gone counts as
  removed and nothing is written, as #69 ignores stale `empty` ids.
  Rejected: reassigning the default automatically (silently changes what
  `/` shows), a new-default select in the remove form (a second job for
  that form; a default picker is a separate candidate), a two-step
  button like Empty/Keep (the click is the save, so it's a home-made
  confirm), and a typed confirmation (heavy for one admin). The media
  delete guard needed nothing: it reads the saved copy, so an image used
  only by a removed job becomes deletable. Verified with Playwright on
  the demo stack (9 steps: default job shows the note; confirm
  dismissed keeps the job; only that job leaves the stored copy;
  `?job=<removed>` falls back on home and admin; removed in another tab
  succeeds without a write; a stale tab's Save gets the existing "no
  job" error; a default set through JSON in another tab is refused;
  backend down keeps the form; `?removed=` with a live or invalid id
  shows nothing). Not exercised: the media guard after a removal
  (Cloudinary). Merged as #72 (`5c5cda9`) on 2026-11-06; not yet tried
  in production.
- The character sheet as an in-repo workspace package (step 4 of its
  extraction path; planner, then reviewed against the code, then three
  PRs, each through implementers and the reviewer):
  - npm workspace root (#74, `24b67f2`): a root `package.json` with
    workspaces `frontend` and `packages/*`, and one `package-lock.json` at
    the repo root (moved with `git mv`; the same 587 `name@version` pairs
    before and after). Why: Turbopack resolves only files under the root
    it infers from the lockfile, so `packages/` needed the lockfile above
    it; a `file:` dependency would also have left the package's `react`
    and `zod` imports unresolvable. CI, `setup-worktree.sh` and the
    Vercel install run `npm ci` at the root (npm, run in `frontend/`,
    finds the root itself); `demo/stack.mjs` resolves `next` instead of
    `./node_modules/.bin`. The frontend implementer owns `packages/`.
    Owner checked the Vercel settings (Root Directory `frontend`, files
    outside it included, default install, no Ignored Build Step).
  - The move (#75, `717a23d`): `packages/eorzean-character-sheet/`
    (`@alexle08/eorzean-character-sheet`, 1.0.0, private), TypeScript
    source with no build step (Next transpiles workspace packages itself,
    so no `transpilePackages`). Entries `.` (data, no React), `/react`,
    `/schema`, plus the CSS and JSON Schema files, so server code never
    loads React or CSS. The boundary is the package's own ESLint config
    (only `react`, `zod` and its own files; `next build` wouldn't catch an
    `@/` import, since the frontend's `paths` apply to it), run by the
    frontend's `lint`. Nothing rendered differently: four pages
    pixel-identical before and after, the fifth differing only by the
    config's `$schema` path line.
  - Versioned `$id` (this PR):
    `https://cdn.jsdelivr.net/npm/@alexle08/eorzean-character-sheet@1/character-sheet.schema.json`,
    built from the package's `name` and major version. A compatible
    schema change keeps `@1`; a breaking one bumps the major version and
    so the `$id`. An npm CDN URL survives the repo move and opens once
    published; a site URL would tie the contract to this subdomain.
    `test_schema_has_versioned_id` checks the format (the copy-match test
    alone would pass a wrong URL regenerated into both copies). The
    schema has no `$ref`s, so the absolute `$id` changes no validation;
    the admin JSON save was checked on the demo stack.

## Next up (candidates, unordered)

- Character sheet follow-ups, roughly in order:
  - Content, entered in production through the form (no code needed):
    more jobs as needed (Teacher added 2026-11-05; AI development not
    yet), and Education sections (the `education` slot exists). The
    built-in `lib/character-config.json` doesn't have Teacher, which is
    fine: keeping it in step is low priority (see the last item below).
  - A hidden/draft flag so a new job isn't live before it's edited, if
    adding jobs becomes routine. Missing today.
  - Setting the default job from the form (JSON-only today). The remove
    form refuses the default job and points to the JSON editor; a default
    picker would let that note point here instead.
  - Anchor targets aren't checked against what the home page renders
    (a section the job doesn't have scrolls nowhere). A save-time
    warning, like unknown keys, if it ever bites.
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
    using it. A Python validator package (`find_issues` and its `oneOf`
    explanation) only if someone asks, and then in the same repository, so
    it ships with the schema version it checks. Done so far: the in-repo
    package with its versioned `$id` (see Done). Left for the move:
    - Its own repository and a build step for publishing (keeping
      `SlotHover`'s `"use client"`); `generate:character-schema`'s `cp`
      then reads the installed package.
    - The npm scope `@alexle08` (check it's free), and "Eorzea" is a
      Square Enix trademark: check their fan-content terms or publish
      under a neutral name.
    - Accessibility, before publishing: the non-link slot face
      (`<span tabIndex={0}>`) is a focus stop with no role. Give it one
      (`role="group"` with `aria-labelledby`, or a `<button type="button">`)
      and drop its `no-noninteractive-tabindex` disable.
    - Package lint: add `eslint-plugin-react` (`react/jsx-key`,
      `react/no-unescaped-entities` and others `eslint-config-next`
      applied). The import allowlist doesn't see dynamic `import()` or
      `require()`; add a `no-restricted-syntax` rule if the package ever
      uses them.
    - Public API: a plain `LIMITS` object instead of exporting zod
      sub-schemas (the admin form reads `jobSchema.shape` and others), and
      `findUnknownKeys`'s recursion-only `path` argument.
    - A `tsconfig.json` in the package, so editors opening it alone get
      the site's settings.

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
- Low priority (decided 2026-11-05): keeping the built-in values
  (`FALLBACK_CONTENT`, `lib/character-config.json`) in step with edits
  saved in production, and cleaning up production's leftover test edits
  (Healthcare's level "React guy", slot texts "truth" and "test text",
  icons "HLC"/"ECM", the portrait alt text "lami's avatar sticker"). The
  fallback notice makes it visible when built-in values are showing, so
  they don't need to match production. Copy changes across only when they
  matter during an outage, as with the portrait.
