import { z } from "zod";

// The one contract every content source produces: plain JSON data, no
// functions or React nodes, so a JSON file, an admin API, or a CMS adapter
// can all feed the same component. Types are inferred from these schemas
// (see types.ts), so the two can't drift apart.
//
// Imports nothing but zod, so plain Node (scripts/generate-schema.mjs) can
// run it.

// The hyphen is escaped so the pattern also works in an HTML pattern
// attribute, which browsers compile with the v flag, where a bare "-" in a
// class is a syntax error and the attribute is silently ignored.
export const ID_PATTERN = /^[a-z0-9][a-z0-9\-]*$/;

const id = z
  .string()
  .max(40)
  .regex(ID_PATTERN, "lowercase letters, digits, and hyphens; starts with a letter or digit");

const text = (max: number) => z.string().trim().min(1).max(max);

export const SLOT_POSITIONS = ["header-start", "left", "right", "header-end"] as const;

export const slotDefSchema = z.object({
  id: id.describe("Stable id; jobs fill slots by this id."),
  label: text(40).describe('The slot\'s name, e.g. "Skills". Shown in its tooltip, and under the square on narrow screens.'),
  position: z
    .enum(SLOT_POSITIONS)
    .describe(
      "left/right: the columns beside the portrait (6 each fills them). header-start/header-end: one slot each, either side of the job name.",
    ),
  icon: text(4)
    .optional()
    .describe("Up to 4 characters drawn in the square. Defaults to the label's first two letters."),
});

export const pairSchema = z.object({ label: text(40), value: text(80) });

// Named because zod doesn't expose an array's max the way it does a
// string's maxLength, and the admin form needs both.
export const TOOLTIP_MAX_TAGS = 3;
export const TOOLTIP_MAX_ITEMS = 10;

export const tooltipSchema = z.object({
  title: text(80),
  tags: z.array(text(24)).max(TOOLTIP_MAX_TAGS).optional().describe("Short markers above the title."),
  subtitle: text(120).optional(),
  stat: pairSchema.optional().describe("One headline figure, on its own ruled line."),
  items: z
    .array(z.union([text(80), pairSchema]))
    .max(TOOLTIP_MAX_ITEMS)
    .optional()
    .describe("Listed in order, most relevant first. Label/value pairs render as a two-column table."),
  note: text(240).optional(),
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
      .max(300)
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
      .max(300),
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
    .max(500)
    .optional()
    .describe("An image drawn in the square instead of the slot's glyph (decorative; the label names it)."),
});

export const portraitSchema = z.object({
  src: z.string().min(1).max(500).describe("Any image URL: Cloudinary, a CMS asset, or a local path."),
  alt: z.string().max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  framing: z
    .enum(["face", "full"])
    .default("face")
    .describe("Where the photo is cropped from when it fills the frame. face: kept near the top. full: centered."),
});

export const jobSchema = z.object({
  id: id.describe("Used in the URL: ?job=<id>."),
  name: text(40).describe('Short name for the job menu, e.g. "Healthcare".'),
  title: text(80).describe('The panel heading, e.g. "Developer in healthcare".'),
  icon: text(4).optional().describe("Glyph in the job emblem beside the title. Defaults to the name's first two letters."),
  level: z.object({
    label: text(20).describe('e.g. "Lv." or "Experience".'),
    value: text(40),
  }),
  portrait: portraitSchema.optional(),
  badge: pairSchema.optional().describe("A figure in the portrait's top corner."),
  slots: z
    .record(id, slotContentSchema)
    .describe("Content per slot id. A slot without an entry renders empty."),
  sections: z
    .record(id, z.string().max(10_000))
    .optional()
    .describe("Markdown per page section id. The host page renders these; the panel doesn't."),
});

export const characterSheetConfigSchema = z.object({
  $schema: z.string().optional(),
  title: text(60).optional().describe("Text in the panel's top bar."),
  defaultJobId: id,
  slots: z.array(slotDefSchema).min(1).max(20),
  jobs: z.array(jobSchema).min(1).max(20),
});
