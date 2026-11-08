# Character sheet (`@solution-nine/wol-character-panel`)

A panel modelled on an RPG character/equipment screen:

```
title bar                                  [Change job]
[slot]  level / emblem + job title               [slot]
[col]   portrait (optional corner badge)          [col]
```

The two header slots sit either side of the job title (think main weapon and
job stone), and the left and right columns hold 6 slots each. Each slot shows a
compact item-card tooltip on hover or keyboard focus. Clicking it goes to a page
section, another page, or an external site. Changing the job (`?job=<id>`) swaps the slots, tooltips, and
portrait, and the host page can swap its own content too.

An in-repo workspace package, used by the site as an installed dependency.
It imports nothing but React and zod, enforced by `eslint.config.mjs` (the
host's `lint` script runs it). It ships TypeScript source with no build step;
the host's bundler compiles it.

## Entries

| Import | What it holds |
| --- | --- |
| `@solution-nine/wol-character-panel` | `parseConfig`, `loadConfig`, `findUnknownKeys`, `publicConfig`, `resolveJob`, `jobHref`, `actionHref`, `withQuery` (sets or removes query parameters on an href, keeping the rest; `jobHref` and `actionHref` are built on it), the config types, and the limits as plain values: `LIMITS` (max lengths and counts, grouped like the config), `ID_PATTERN` and `PARAM_NAME_PATTERN`. No React or CSS, so server code and plain Node can use it |
| `@solution-nine/wol-character-panel/react` | `CharacterSheet`, `CharacterSheetProps`, `LinkRendererProps`. The component imports its own CSS |
| `@solution-nine/wol-character-panel/schema` | `characterSheetConfigSchema`, the whole config's zod schema. Its parts are internal |
| `@solution-nine/wol-character-panel/character-sheet.css` | The styles, for hosts that want to control CSS order |
| `@solution-nine/wol-character-panel/character-sheet.schema.json` | The JSON Schema other backends validate against |

`react` and `zod` are peer dependencies: the host provides them.

## Files

| File | Purpose |
| --- | --- |
| `src/index.ts` | The data-side entry (re-exports only) |
| `src/schema.ts` | `LIMITS`, `ID_PATTERN`, `PARAM_NAME_PATTERN` and the zod schemas built from them: the config contract |
| `src/schema-entry.ts` | The `/schema` entry (re-exports only) |
| `src/types.ts` | Types inferred from the schemas |
| `src/parse.ts` | `parseConfig` (drops invalid jobs, reports errors) and `loadConfig` (fallback chain of sources) |
| `src/resolve.ts` | `resolveJob`, `withQuery`, and the links built on it: `jobHref`, `actionHref` |
| `src/CharacterSheet.tsx` | The panel (a Server Component) |
| `src/SlotHover.tsx` | The only client code: Escape dismisses a tooltip. Private: no entry exports it |
| `src/character-sheet.css` | Styles and themes; everything themable is a `--cs-*` variable |
| `character-sheet.schema.json` | Generated JSON Schema for editing a config file by hand |
| `scripts/generate-schema.mjs` | Regenerates the JSON Schema (`npm run generate:schema`) |
| `eslint.config.mjs` | Lint rules (React, hooks, jsx-a11y, TypeScript) and the import allowlist (`npm run lint`) |
| `tsconfig.json` | Compiler options for editors and `npx tsc -p .`; the host builds with its own |

## Config

A config is plain JSON. Add `"$schema"` pointing at
`character-sheet.schema.json` to get autocomplete and validation in your editor.
The JSON Schema rejects unknown keys, so a typo like `subtitel` is an error
when writing a config, while `parseConfig` strips unknown keys when reading one
(`findUnknownKeys` lists them).

The schema's `$id` is
`https://cdn.jsdelivr.net/npm/@solution-nine/wol-character-panel@1/character-sheet.schema.json`.
`scripts/generate-schema.mjs` builds it from `name` and the major part of
`version` in `package.json`, so it names the contract, not a release:

- A compatible schema change (a new optional field, a looser limit) keeps
  `@1`.
- A breaking change (a new required field, a tighter limit, a removed key)
  bumps the major version in `package.json`, which changes the `$id` to `@2`.

The URL opens once the package is published to npm; until then it is only an
identifier.

```json
{
  "title": "Character profile",
  "defaultJobId": "healthcare",
  "slots": [
    { "id": "core", "label": "Core stack", "position": "header-start", "icon": "◆" },
    { "id": "skills", "label": "Skills", "position": "left", "icon": "Sk" }
  ],
  "jobs": [
    {
      "id": "healthcare",
      "name": "Healthcare",
      "title": "Developer in healthcare",
      "icon": "Hc",
      "level": { "label": "Lv.", "value": "4" },
      "portrait": { "src": "https://…/me.jpg", "alt": "…", "framing": "face" },
      "badge": { "label": "Projects", "value": "3" },
      "slots": {
        "skills": {
          "tooltip": {
            "title": "Skills",
            "tags": ["Most relevant first"],
            "stat": { "label": "Years", "value": "4" },
            "items": [{ "label": "Front end", "value": "React, TypeScript" }, "Accessibility"]
          },
          "action": { "kind": "anchor", "target": "skills" }
        }
      },
      "sections": { "skills": "Markdown the host page renders under #skills" }
    }
  ]
}
```

- **Slots** are the layout, and their labels are free text. `position` is one
  of `left` or `right` (6 per column fills it), or `header-start` or
  `header-end` (one each).
- **Empty slots:** a slot that a job doesn't fill renders as a dimmed empty
  square.
- **Square icons:** a slot's square shows its `icon` glyph, or a job can set an
  image per slot with `iconSrc`.
- **Actions** have one of these kinds:
  - `anchor`: a same-page `#id`.
  - `link`: a site path.
  - `external`: an http(s) URL, opening in the same tab unless `newTab` is set.
  - `param`: the current page (keeping `?job=`) with one query parameter
    set, e.g. `{ "kind": "param", "name": "stack", "value": "React", "target": "projects" }`
    links to `/?stack=React#projects`. `target` is optional. The host page
    reads the parameter; the panel doesn't. `name` can't be `job`, and one
    matching the host's `jobParam` renders tooltip-only. Links go through
    `renderLink` with `intent: "param"`. To mark the slot whose value the
    page is applying (a filter that's on), pass `isParamActive(name, value)`:
    the panel can't read the page's parameters or know how the host matches
    them. That slot gets `aria-current="true"` and a highlight.
  - `none`: tooltip only.
- **Status:** a job's `status` is `published` (the default when it's left
  out), `draft` (not ready yet) or `hidden` (taken off the site). Pass the
  config through `publicConfig()` before rendering it for visitors: it leaves
  out drafts and hidden jobs, so they aren't in the job menu and a `?job=`
  link to one falls back to the default job. Editors use the whole config.
  The default job must be published, and a config needs at least one
  published job: `parseConfig` reports both, falling back to the first
  published job or, with none, rejecting the config.
- **Sections** are data for the host page. The panel doesn't render them.
- **Tooltips** hold `tags`, `title`, `subtitle` (which defaults to the slot's
  label), one `stat` line, and `items`. Plain strings render as a list; label
  and value pairs render as a two-column table. There's also a `note`.
- **Portrait:** it fills the frame between the columns. `framing` picks the
  crop: `face` keeps the top, `full` centers. With no portrait, a placeholder
  silhouette is shown.

## Usage

```tsx
import { parseConfig, resolveJob } from "@solution-nine/wol-character-panel";
import { CharacterSheet } from "@solution-nine/wol-character-panel/react";

const { config, errors } = parseConfig(json);   // or: const { config } = await loadConfig(sources, fallback)
const job = resolveJob(config, searchParams.job);

<CharacterSheet
  config={config}
  job={job}
  theme="document"          // or "game"
  labels="narrow"           // slot names under squares: "narrow" (default) or "always"
  showSockets               // optional: two decorative socket dots on each filled slot
  showToolbar               // optional: a decorative row of round buttons under the portrait
  basePath="/"              // where the job links point
  renderLink={(p) => …}     // optional: your router's link (default <a>)
  renderPortrait={(p) => …} // optional: your image component (default <img>)
  isParamActive={(name, value) => …} // optional: true for the param value the page applies
/>
```

`loadConfig(sources, fallback)` tries each `{ name, load }` source in order,
such as an admin API, a CMS adapter, or a remote JSON file. It uses the first
one that yields a usable config. A source whose `load` resolves to `undefined`
has nothing yet (no save, an empty CMS entry) and is skipped without an issue;
a `load` that throws (unreachable, an HTTP error) is an issue. It never throws.
It resolves to `{ config, source, issues }`: `source` is the name of the source
used, or `null` when no source had a usable config and `config` is
`fallback`. `source === null` with issues means the page shows the fallback
because something failed, which a host can tell visitors about.

## Behaviour

- **Tooltips:**
  - CSS shows them on hover (on devices that can hover) and on keyboard focus,
    so they work before hydration and without JavaScript.
  - Escape hides them (WCAG 1.4.13).
  - On touch screens, a tap simply follows the slot's link.
- **Job menu:** a `<details>` element listing job links. It needs no
  JavaScript, works with the back button, and makes every job shareable.
- **Layout:** below a 26rem container width, the portrait moves on top. The
  columns become 3-column grids with the slot names showing, since touch
  screens get no tooltip. This is a container query, so it follows the
  panel's width, not the viewport.

`showSockets` and `showToolbar` are visual only for now. They're hidden from
assistive tech and aren't focusable. When either one gets a real function, make
it a real control (`<button>`, with a label) instead.

## Theming

Override any `--cs-*` variable on `.cs`, or add a theme block like
`.cs[data-cs-theme="game"]`. The `document` theme reads the host's
`--paper`/`--ink`/`--signal`/… tokens when they exist and falls back to neutral
colours otherwise.
