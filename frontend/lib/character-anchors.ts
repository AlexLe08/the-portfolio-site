import type { CharacterSheetConfig, Job, SlotDef } from "@alexle08/eorzean-character-sheet";
import type { ProjectSummary } from "./projects";

// What the home page (components/HomeView.tsx) renders below the panel and
// which query parameters it reads, kept here so the admin editor's
// suggestions and its save-time checks can't drift from it.
// The package doesn't know these ids: the page sections and the project
// list are this site's, not the character sheet's.

// The project list's id, after the job's sections.
export const PROJECTS_ANCHOR = "projects";

// The query parameter the home page filters the project list by (a stack
// tag). A param slot action with any other name does nothing on this site.
export const STACK_PARAM = "stack";

// The job's page sections, in slot order; each is rendered with its
// slot's id.
export function homeSections(config: CharacterSheetConfig, job: Job): SlotDef[] {
  return config.slots.filter((slot) => job.sections?.[slot.id]);
}

// The ids an anchor action can scroll to when the home page shows this job.
export function homeAnchorTargets(config: CharacterSheetConfig, job: Job): string[] {
  return [...homeSections(config, job).map((slot) => slot.id), PROJECTS_ANCHOR];
}

// The ?stack= value to filter by, trimmed, or null for no filter. A
// repeated parameter uses the first value, like resolveJob.
export function readStackParam(param: string | string[] | undefined): string | null {
  const wanted = (Array.isArray(param) ? param[0] : param)?.trim();
  return wanted ? wanted : null;
}

// The projects using one stack tag: an exact match, ignoring case. tag is
// the projects' own spelling ("React" for ?stack=react), or null when none
// matches. null for no filter, so the caller can tell "no filter" from
// "nothing matches".
export function filterByStack(
  projects: ProjectSummary[],
  param: string | string[] | undefined,
): { projects: ProjectSummary[]; tag: string | null } | null {
  const wanted = readStackParam(param)?.toLowerCase();
  if (!wanted) return null;
  const matches = (tag: string) => tag.trim().toLowerCase() === wanted;
  const filtered = projects.filter((project) => project.stack.some(matches));
  return { projects: filtered, tag: filtered[0]?.stack.find(matches) ?? null };
}

// Every stack tag the projects use, sorted and de-duplicated: the values a
// ?stack= action can usefully set.
export function stackTags(projects: { stack: string[] }[]): string[] {
  return [...new Set(projects.flatMap((project) => project.stack))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

// Anchor actions, and param actions' targets, that the home page doesn't
// render for their job, so clicking the slot scrolls nowhere. Every job,
// drafts and hidden ones included, so a link is fixed before the job is
// published. Reported after saving rather than blocking it, unlike unknown
// keys: the config is valid, and the missing section may be the next edit.
export function findDeadAnchors(config: CharacterSheetConfig): string[] {
  return config.jobs.flatMap((job) => {
    const targets = new Set(homeAnchorTargets(config, job));
    return config.slots.flatMap((slot) => {
      const action = job.slots[slot.id]?.action;
      const target =
        action?.kind === "anchor" ? action.target : action?.kind === "param" ? action.target : undefined;
      if (target === undefined || targets.has(target)) return [];
      return [`${job.name}, ${slot.label}: #${target} isn't a section this job shows`];
    });
  });
}

// Param actions whose name the home page doesn't read, so clicking the
// slot only changes the URL. Reported like dead anchors: the config is
// valid, and the package allows any name for other hosts.
export function findDeadParams(config: CharacterSheetConfig): string[] {
  return config.jobs.flatMap((job) =>
    config.slots.flatMap((slot) => {
      const action = job.slots[slot.id]?.action;
      if (action?.kind !== "param" || action.name === STACK_PARAM) return [];
      return [`${job.name}, ${slot.label}: ?${action.name}= isn't read by the home page`];
    }),
  );
}
