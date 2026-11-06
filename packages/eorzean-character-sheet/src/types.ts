import type { z } from "zod";
import type {
  characterSheetConfigSchema,
  jobSchema,
  portraitSchema,
  slotActionSchema,
  slotContentSchema,
  slotDefSchema,
  tooltipSchema,
} from "./schema";

export type CharacterSheetConfig = z.output<typeof characterSheetConfigSchema>;
export type Job = z.output<typeof jobSchema>;
export type SlotDef = z.output<typeof slotDefSchema>;
export type SlotContent = z.output<typeof slotContentSchema>;
export type SlotAction = z.output<typeof slotActionSchema>;
export type Tooltip = z.output<typeof tooltipSchema>;
export type Portrait = z.output<typeof portraitSchema>;

export type Theme = "document" | "game";
export type SlotPosition = SlotDef["position"];
export type JobStatus = Job["status"];
export type TooltipItem = NonNullable<Tooltip["items"]>[number];
