import { z } from "zod";
import { characterSheetConfigSchema, jobSchema } from "./schema";
import type { CharacterSheetConfig, Job } from "./types";

export type ParseResult = {
  // null only when nothing usable is left: the top-level shape is wrong or
  // no job is valid. Otherwise invalid jobs are dropped and listed in errors.
  config: CharacterSheetConfig | null;
  errors: string[];
};

// Everything but the jobs is checked as a whole: without valid slots there
// is no panel to draw. Jobs are checked one at a time, so one bad entry
// (say, a typo in a CMS) costs that job and not the whole panel.
const shellSchema = characterSheetConfigSchema.extend({ jobs: z.array(z.unknown()).min(1) });

function describe(error: z.ZodError, prefix: string): string[] {
  return error.issues.map((issue) => {
    const path = [prefix, ...issue.path.map(String)].filter(Boolean).join(".");
    return `${path || "(root)"}: ${issue.message}`;
  });
}

export function parseConfig(input: unknown): ParseResult {
  const shell = shellSchema.safeParse(input);
  if (!shell.success) return { config: null, errors: describe(shell.error, "") };

  const errors: string[] = [];
  const slotIds = new Set<string>();
  for (const slot of shell.data.slots) {
    if (slotIds.has(slot.id)) errors.push(`slots: duplicate id "${slot.id}"`);
    slotIds.add(slot.id);
  }

  const jobs: Job[] = [];
  shell.data.jobs.forEach((raw, index) => {
    const result = jobSchema.safeParse(raw);
    if (!result.success) {
      errors.push(...describe(result.error, `jobs.${index}`));
      return;
    }
    const job = result.data;
    if (jobs.some((other) => other.id === job.id)) {
      errors.push(`jobs.${index}: duplicate id "${job.id}", dropped`);
      return;
    }
    for (const slotId of Object.keys(job.slots)) {
      if (!slotIds.has(slotId)) errors.push(`jobs.${index}.slots: unknown slot "${slotId}", ignored`);
    }
    jobs.push(job);
  });

  if (jobs.length === 0) return { config: null, errors: [...errors, "jobs: no valid job"] };

  let { defaultJobId } = shell.data;
  if (!jobs.some((job) => job.id === defaultJobId)) {
    errors.push(`defaultJobId: no valid job "${defaultJobId}", using "${jobs[0].id}"`);
    defaultJobId = jobs[0].id;
  }

  return { config: { ...shell.data, defaultJobId, jobs }, errors };
}

// A content source: anything that can produce raw config data. Adapters for
// an API, a CMS, or a remote JSON file implement this; the component never
// knows which one it got.
export type ConfigSource = {
  name: string;
  load: () => Promise<unknown>;
};

export type LoadIssue = { source: string; errors: string[]; error?: unknown };

// Tries each source in order and uses the first one that yields a usable
// config, falling back to `fallback` (normally a bundled JSON file). Never
// throws: problems go to onIssue (logging, Sentry) instead.
export async function loadConfig(
  sources: ConfigSource[],
  fallback: CharacterSheetConfig,
  onIssue?: (issue: LoadIssue) => void,
): Promise<CharacterSheetConfig> {
  for (const source of sources) {
    try {
      const { config, errors } = parseConfig(await source.load());
      if (errors.length > 0) onIssue?.({ source: source.name, errors });
      if (config) return config;
    } catch (error) {
      onIssue?.({ source: source.name, errors: [String(error)], error });
    }
  }
  return fallback;
}
