import { z } from "zod";

// The one contract every content source produces: plain JSON data, no
// functions or React nodes, so a JSON file, an admin API, or a CMS adapter
// can all feed the same component. Types are inferred from these schemas
// (see types.ts), so the two can't drift apart.
//
// Imports nothing but zod, so plain Node (scripts/generate-schema.mjs) can
// run it: Node only resolves relative imports with a .ts extension, which
// the host's tsconfig doesn't allow, so LIMITS lives here too. Public: LIMITS
// and ID_PATTERN (from "."), characterSheetConfigSchema (from "/schema", see
// schema-entry.ts). The parts are internal.

// The hyphen is escaped so the pattern also works in an HTML pattern
// attribute, which browsers compile with the v flag, where a bare "-" in a
// class is a syntax error and the attribute is silently ignored.
export const ID_PATTERN = /^[a-z0-9][a-z0-9\-]*$/;

// The config's limits as plain values, so a form, a CMS adapter or any
// other consumer can read them without zod. The checks below are built
// from these, so they can't drift from what parsing enforces. Grouped like
// the config: LIMITS.job.name is a job's `name`.
export const LIMITS = {
  // Every id: slots, jobs, section and anchor targets.
  id: 40,
  config: { title: 60, slots: 20, jobs: 20 },
  slot: { label: 40, icon: 4 },
  job: { name: 40, title: 80, icon: 4, levelLabel: 20, levelValue: 40, section: 10_000 },
  portrait: { src: 500, alt: 300 },
  // A label/value pair: a job's badge, a tooltip's stat or item.
  pair: { label: 40, value: 80 },
  // tags and items are counts; item is a plain line item's length.
  tooltip: { title: 80, tag: 24, tags: 3, subtitle: 120, item: 80, items: 10, note: 240 },
  slotContent: { iconSrc: 500 },
  // A link's path or an external URL.
  action: { href: 300 },
} as const;

const id = z
  .string()
  .max(LIMITS.id)
  .regex(ID_PATTERN, "lowercase letters, digits, and hyphens; starts with a letter or digit");

const text = (max: number) => z.string().trim().min(1).max(max);

export const SLOT_POSITIONS = ["header-start", "left", "right", "header-end"] as const;

export const slotDefSchema = z.object({
  id: id.describe("Stable id; jobs fill slots by this id."),
  label: text(LIMITS.slot.label).describe('The slot\'s name, e.g. "Skills". Shown in its tooltip, and under the square on narrow screens.'),
  position: z
    .enum(SLOT_POSITIONS)
    .describe(
      "left/right: the columns beside the portrait (6 each fills them). header-start/header-end: one slot each, either side of the job name.",
    ),
  icon: text(LIMITS.slot.icon)
    .optional()
    .describe("Up to 4 characters drawn in the square. Defaults to the label's first two letters."),
});

export const pairSchema = z.object({ label: text(LIMITS.pair.label), value: text(LIMITS.pair.value) });

export const tooltipSchema = z.object({
  title: text(LIMITS.tooltip.title),
  tags: z.array(text(LIMITS.tooltip.tag)).max(LIMITS.tooltip.tags).optional().describe("Short markers above the title."),
  subtitle: text(LIMITS.tooltip.subtitle).optional(),
  stat: pairSchema.optional().describe("One headline figure, on its own ruled line."),
  items: z
    .array(z.union([text(LIMITS.tooltip.item), pairSchema]))
    .max(LIMITS.tooltip.items)
    .optional()
    .describe("Listed in order, most relevant first. Label/value pairs render as a two-column table."),
  note: text(LIMITS.tooltip.note).optional(),
});

export const slotActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("anchor"),
    target: id.describe("Element id on the same page, without the #."),
  }),
  z.object({
    kind: z.literal("link"),
    href: z
      .string()
      .max(LIMITS.action.href)
      .regex(/^\/(?![/\\])/, "a path on this site, starting with a single /")
      .describe("A path on the same site."),
  }),
  z.object({
    kind: z.literal("external"),
    // The regex repeats the protocol rule because z.url's `protocol` option
    // doesn't carry over to the generated JSON Schema (it becomes only
    // "format": "uri"), and the backend validates against that schema.
    href: z
      .url({ protocol: /^https?$/ })
      .regex(/^https?:\/\//, "an http or https URL")
      .max(LIMITS.action.href),
    newTab: z.boolean().optional().describe("Open in a new tab. Off by default."),
  }),
  z.object({ kind: z.literal("none") }),
]);

export const slotContentSchema = z.object({
  tooltip: tooltipSchema,
  action: slotActionSchema,
  iconSrc: z
    .string()
    .min(1)
    .max(LIMITS.slotContent.iconSrc)
    .optional()
    .describe("An image drawn in the square instead of the slot's glyph (decorative; the label names it)."),
});

export const portraitSchema = z.object({
  src: z.string().min(1).max(LIMITS.portrait.src).describe("Any image URL: Cloudinary, a CMS asset, or a local path."),
  alt: z.string().max(LIMITS.portrait.alt),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  framing: z
    .enum(["face", "full"])
    .default("face")
    .describe("Where the photo is cropped from when it fills the frame. face: kept near the top. full: centered."),
});

export const jobSchema = z.object({
  id: id.describe("Used in the URL: ?job=<id>."),
  name: text(LIMITS.job.name).describe('Short name for the job menu, e.g. "Healthcare".'),
  title: text(LIMITS.job.title).describe('The panel heading, e.g. "Developer in healthcare".'),
  icon: text(LIMITS.job.icon).optional().describe("Glyph in the job emblem beside the title. Defaults to the name's first two letters."),
  level: z.object({
    label: text(LIMITS.job.levelLabel).describe('e.g. "Lv." or "Experience".'),
    value: text(LIMITS.job.levelValue),
  }),
  portrait: portraitSchema.optional(),
  badge: pairSchema.optional().describe("A figure in the portrait's top corner."),
  slots: z
    .record(id, slotContentSchema)
    .describe("Content per slot id. A slot without an entry renders empty."),
  sections: z
    .record(id, z.string().max(LIMITS.job.section))
    .optional()
    .describe("Markdown per page section id. The host page renders these; the panel doesn't."),
});

export const characterSheetConfigSchema = z.object({
  $schema: z.string().optional(),
  title: text(LIMITS.config.title).optional().describe("Text in the panel's top bar."),
  defaultJobId: id,
  slots: z.array(slotDefSchema).min(1).max(LIMITS.config.slots),
  jobs: z.array(jobSchema).min(1).max(LIMITS.config.jobs),
});
