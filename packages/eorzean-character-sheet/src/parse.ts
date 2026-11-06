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
  for (const position of ["header-start", "header-end"] as const) {
    const extra = shell.data.slots.filter((slot) => slot.position === position).slice(1);
    for (const slot of extra) errors.push(`slots: "${slot.id}" is a second ${position} slot, not shown`);
  }

  const jobs: Job[] = [];
  // Ids of jobs dropped for their own problems, checked by defaultJobId below.
  const droppedIds = new Set<unknown>();
  shell.data.jobs.forEach((raw, index) => {
    const result = jobSchema.safeParse(raw);
    if (!result.success) {
      errors.push(...describe(result.error, `jobs.${index}`));
      if (isPlainObject(raw)) droppedIds.add(raw.id);
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
    // A default job dropped above already has its own errors listed; a
    // second line for the same problem is only noise. The fallback stands.
    if (!droppedIds.has(defaultJobId)) {
      errors.push(`defaultJobId: no valid job "${defaultJobId}", using "${jobs[0].id}"`);
    }
    defaultJobId = jobs[0].id;
  }

  return { config: { ...shell.data, defaultJobId, jobs }, errors };
}

// Keys in the raw input that parsing dropped, as dotted paths
// ("jobs.0.slots.skills.tooltip.subtitel"). z.object strips keys it doesn't
// know, so a key missing from the parsed copy is one the schema doesn't
// have: usually a typo of an optional field, which the panel then leaves
// out. Pass the config of a parseConfig() call without errors, so its jobs
// line up with the input's by index.
export function findUnknownKeys(raw: unknown, parsed: unknown): string[] {
  return unknownKeysAt(raw, parsed, "");
}

// The recursion, with the path so far. Internal, so a caller can't pass a
// prefix by accident.
function unknownKeysAt(raw: unknown, parsed: unknown, path: string): string[] {
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    return raw.flatMap((item, index) => unknownKeysAt(item, parsed[index], join(path, index)));
  }
  if (!isPlainObject(raw) || !isPlainObject(parsed)) return [];
  return Object.entries(raw).flatMap(([key, value]) =>
    // hasOwn, not `in`: a stray "constructor" key would otherwise match
    // the prototype and pass unreported.
    Object.hasOwn(parsed, key) ? unknownKeysAt(value, parsed[key], join(path, key)) : [join(path, key)],
  );
}

function join(path: string, key: string | number): string {
  return path ? `${path}.${key}` : String(key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A content source: anything that can produce raw config data. Adapters for
// an API, a CMS, or a remote JSON file implement this; the component never
// knows which one it got. Resolving to undefined means the source has
// nothing yet (no save, an empty CMS entry): not a problem to report, so
// loadConfig moves on to the next source quietly. Throwing means it failed
// (unreachable, an HTTP error), which becomes an issue.
export type ConfigSource = {
  name: string;
  load: () => Promise<unknown>;
};

export type LoadIssue = { source: string; errors: string[]; error?: unknown };

export type LoadResult = {
  config: CharacterSheetConfig;
  // The name of the source used, or null for `fallback`.
  source: string | null;
  // Every problem met on the way, including in a source that was still
  // used (a dropped job). With source null, a non-empty list means the
  // fallback is showing because something failed, not because no source
  // had anything yet.
  issues: LoadIssue[];
};

// Tries each source in order and uses the first one that yields a usable
// config, falling back to `fallback` (normally a bundled JSON file). Never
// throws: the host decides what to do with the issues (logging, Sentry, a
// notice that the page shows the fallback).
export async function loadConfig(
  sources: ConfigSource[],
  fallback: CharacterSheetConfig,
): Promise<LoadResult> {
  const issues: LoadIssue[] = [];
  for (const source of sources) {
    try {
      const raw = await source.load();
      if (raw === undefined) continue;
      const { config, errors } = parseConfig(raw);
      if (errors.length > 0) issues.push({ source: source.name, errors });
      if (config) return { config, source: source.name, issues };
    } catch (error) {
      issues.push({ source: source.name, errors: [String(error)], error });
    }
  }
  return { config: fallback, source: null, issues };
}
