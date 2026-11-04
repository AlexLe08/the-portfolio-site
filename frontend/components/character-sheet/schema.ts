import { z } from "zod";

// The one contract every content source produces: plain JSON data, no
// functions or React nodes, so a JSON file, an admin API, or a CMS adapter
// can all feed the same component. Types are inferred from these schemas
// (see types.ts), so the two can't drift apart.
//
// Imports nothing but zod: this folder is meant to move to its own package.

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const id = z
  .string()
  .max(40)
  .regex(ID_PATTERN, "lowercase letters, digits, and hyphens; starts with a letter or digit");

const text = (max: number) => z.string().trim().min(1).max(max);

export const slotDefSchema = z.object({
  id: id.describe("Stable id; jobs fill slots by this id."),
  label: text(40).describe('Shown under the square, e.g. "Skills".'),
  side: z.enum(["left", "right"]).describe("Which column the slot sits in."),
  icon: text(4)
    .optional()
    .describe("Up to 4 characters drawn in the square. Defaults to the label's first two letters."),
});

export const tooltipSchema = z.object({
  title: text(80),
  subtitle: text(120).optional(),
  items: z.array(text(80)).max(12).optional().describe("Listed in order, most relevant first."),
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
    href: z.url({ protocol: /^https?$/ }).max(300),
    newTab: z.boolean().optional().describe("Open in a new tab. Off by default."),
  }),
  z.object({ kind: z.literal("none") }),
]);

export const slotContentSchema = z.object({
  tooltip: tooltipSchema,
  action: slotActionSchema,
});

export const portraitSchema = z.object({
  src: z.string().min(1).max(500).describe("Any image URL: Cloudinary, a CMS asset, or a local path."),
  alt: z.string().max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  framing: z
    .enum(["face", "full"])
    .default("face")
    .describe("face: a near-square head-and-shoulders frame. full: a tall full-body frame."),
});

export const jobSchema = z.object({
  id: id.describe("Used in the URL: ?job=<id>."),
  name: text(40).describe('Short name for the job menu, e.g. "Healthcare".'),
  title: text(80).describe('The panel heading, e.g. "Developer in healthcare".'),
  level: z.object({
    label: text(20).describe('e.g. "Lv." or "Experience".'),
    value: text(40),
  }),
  portrait: portraitSchema.optional(),
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
  defaultJobId: id,
  slots: z.array(slotDefSchema).min(1).max(16),
  jobs: z.array(jobSchema).min(1).max(20),
});
