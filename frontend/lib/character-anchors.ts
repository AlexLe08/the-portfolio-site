import type { Block, CharacterPanelConfig, Job, RowAction, SlotDef } from "@solution-nine/wol-character-panel";
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
export function homeSections(config: CharacterPanelConfig, job: Job): SlotDef[] {
  return config.slots.filter((slot) => job.sections?.[slot.id]);
}

// The ids an anchor action can scroll to when the home page shows this job.
export function homeAnchorTargets(config: CharacterPanelConfig, job: Job): string[] {
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

// The panel's isParamActive for this ?stack= value: a param slot is current
// when it sets the stack filter the page is applying, matched like
// filterByStack (trimmed, ignoring case). With no filter, wanted is
// undefined, which no string equals, so nothing is.
export function stackParamActive(param: string | string[] | undefined): (name: string, value: string) => boolean {
  const wanted = readStackParam(param)?.toLowerCase();
  return (name, value) => name === STACK_PARAM && value.trim().toLowerCase() === wanted;
}

// Every stack tag the projects use, sorted and de-duplicated: the values a
// ?stack= action can usefully set.
export function stackTags(projects: { stack: string[] }[]): string[] {
  return [...new Set(projects.flatMap((project) => project.stack))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

// Every action a job can show, with where it sits, for the checks below:
// its slots, then its gear-set links (the job's own row or the shared one),
// then the rows of every tab and page, with the job's block replacements
// and the rows inside detail windows. Hidden tabs, pages and blocks are
// included, like drafts, so a link is fixed before it's shown.
type PlacedAction = { where: string; action: RowAction };

export function jobActions(config: CharacterPanelConfig, job: Job): PlacedAction[] {
  const slots = config.slots.flatMap((slot) => {
    const action = job.slots[slot.id]?.action;
    return action ? [{ where: slot.label, action }] : [];
  });
  const links = ((job.gearSet ?? config.gearSet)?.links ?? []).map((link) => ({
    where: `gear set, ${link.label}`,
    action: link.action,
  }));
  const rows = (config.tabs ?? []).flatMap((tab) =>
    [
      ...(tab.blocks ?? []).map((block) => ({ where: tab.label, block })),
      ...(tab.pages ?? []).flatMap((page) =>
        page.blocks.map((block) => ({ where: `${tab.label}, ${page.label}`, block })),
      ),
    ].flatMap(({ where, block }) =>
      blockActions(block.id ? (job.blocks?.[block.id] ?? block) : block, where),
    ),
  );
  return [...slots, ...links, ...rows];
}

// The parts of a row these checks read; detail windows only on fields rows.
type ActionRow = { label: string; action?: RowAction; detail?: { blocks: Block[] } };

// A block's rows with an action, each named by the row's label, and the
// rows of a fields row's detail window.
function blockActions(block: Block, where: string): PlacedAction[] {
  const rows: ActionRow[] =
    block.type === "fields" ? block.rows
    : block.type === "levels" ? block.groups.flatMap((group) => group.rows)
    : block.type === "progress" ? block.groups.flatMap((group) => group.rows)
    : [];
  return rows.flatMap((row) => [
    ...(row.action ? [{ where: `${where}, ${row.label}`, action: row.action }] : []),
    ...(row.detail?.blocks.flatMap((inner) => blockActions(inner, `${where}, ${row.label}`)) ?? []),
  ]);
}

// Anchor actions, and param actions' targets, that the home page doesn't
// render for their job, so clicking them scrolls nowhere. Every job,
// drafts and hidden ones included, so a link is fixed before the job is
// published. Reported after saving rather than blocking it, unlike unknown
// keys: the config is valid, and the missing section may be the next edit.
export function findDeadAnchors(config: CharacterPanelConfig): string[] {
  return config.jobs.flatMap((job) => {
    const targets = new Set(homeAnchorTargets(config, job));
    return jobActions(config, job).flatMap(({ where, action }) => {
      const target =
        action.kind === "anchor" ? action.target : action.kind === "param" ? action.target : undefined;
      if (target === undefined || targets.has(target)) return [];
      return [`${job.name}, ${where}: #${target} isn't a section this job shows`];
    });
  });
}

// Param actions whose name the home page doesn't read, so clicking them
// only changes the URL. Reported like dead anchors: the config is valid,
// and the package allows any name for other hosts.
export function findDeadParams(config: CharacterPanelConfig): string[] {
  return config.jobs.flatMap((job) =>
    jobActions(config, job).flatMap(({ where, action }) => {
      if (action.kind !== "param" || action.name === STACK_PARAM) return [];
      return [`${job.name}, ${where}: ?${action.name}= isn't read by the home page`];
    }),
  );
}
