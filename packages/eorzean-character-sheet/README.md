# Character sheet

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

This folder is meant to become its own package. It imports nothing from the site:
only React and zod.

## Files

| File | Purpose |
| --- | --- |
| `schema.ts` | zod schemas: the config contract |
| `types.ts` | Types inferred from the schemas |
| `parse.ts` | `parseConfig` (drops invalid jobs, reports errors) and `loadConfig` (fallback chain of sources) |
| `resolve.ts` | `resolveJob`, `jobHref`, `actionHref` |
| `CharacterSheet.tsx` | The panel (a Server Component) |
| `SlotHover.tsx` | The only client code: Escape dismisses a tooltip |
| `character-sheet.css` | Styles and themes; everything themable is a `--cs-*` variable |
| `character-sheet.schema.json` | Generated JSON Schema for editing a config file by hand |
| `generate-schema.mjs` | Regenerates the JSON Schema (`npm run generate:character-schema`) |

## Config

A config is plain JSON. Add `"$schema"` pointing at
`character-sheet.schema.json` to get autocomplete and validation in your editor.

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
  - `none`: tooltip only.
- **Sections** are data for the host page. The panel doesn't render them.
- **Tooltips** hold `tags`, `title`, `subtitle` (which defaults to the slot's
  label), one `stat` line, and `items`. Plain strings render as a list; label
  and value pairs render as a two-column table. There's also a `note`.
- **Portrait:** it fills the frame between the columns. `framing` picks the
  crop: `face` keeps the top, `full` centers. With no portrait, a placeholder
  silhouette is shown.

## Usage

```tsx
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
