import type { CharacterSheetConfig, Job, SlotDef } from "@alexle08/eorzean-character-sheet";

// What the home page (components/HomeView.tsx) renders below the panel, kept here so the admin
// editor's anchor suggestions and its save-time check can't drift from it.
// The package doesn't know these ids: the page sections and the project
// list are this site's, not the character sheet's.

// The project list's id, after the job's sections.
export const PROJECTS_ANCHOR = "projects";

// The job's page sections, in slot order; each is rendered with its
// slot's id.
export function homeSections(config: CharacterSheetConfig, job: Job): SlotDef[] {
  return config.slots.filter((slot) => job.sections?.[slot.id]);
}

// The ids an anchor action can scroll to when the home page shows this job.
export function homeAnchorTargets(config: CharacterSheetConfig, job: Job): string[] {
  return [...homeSections(config, job).map((slot) => slot.id), PROJECTS_ANCHOR];
}

// Anchor actions whose target the home page doesn't render for their job,
// so clicking the slot scrolls nowhere. Every job, drafts and hidden ones
// included, so a link is fixed before the job is published. Reported
// after saving rather than blocking it, unlike unknown keys: the config is
// valid, and the missing section may be the next edit.
export function findDeadAnchors(config: CharacterSheetConfig): string[] {
  return config.jobs.flatMap((job) => {
    const targets = new Set(homeAnchorTargets(config, job));
    return config.slots.flatMap((slot) => {
      const action = job.slots[slot.id]?.action;
      if (action?.kind !== "anchor" || targets.has(action.target)) return [];
      return [`${job.name}, ${slot.label}: #${action.target} isn't a section this job shows`];
    });
  });
}
