"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { findUnknownKeys, parseConfig } from "@solution-nine/wol-character-panel";
import { adminRequest } from "@/lib/admin-api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { findDeadAnchors, findDeadParams } from "@/lib/character-anchors";
import type { components } from "@/lib/api-types";
import bundledConfig from "@/lib/character-config.json";
import { formText } from "@/lib/form-data";
import { describeSaveFailure, SERVER_UNREACHABLE } from "@/lib/messages";
import { revalidatePublic } from "@/lib/revalidate-public";

// problems lists every issue by path, so a long document can be fixed in
// one pass. A save returns the stored document as compact JSON (for the
// editor to compare with the bundled file without re-fetching), plus the
// anchor actions the home page has no section for and the param actions
// it doesn't read.
export type CharacterSheetFormState =
  | { error: string; problems?: string[] }
  | { saved: string; deadAnchors: string[]; deadParams: string[] }
  | null;

type JsonObject = Record<string, unknown>;

// parseConfig's messages end with what the home page's lenient read does
// about the problem (", dropped", ", using "healthcare""). Here nothing is
// saved, so that part would mislead. A suffix added later just shows again.
const LENIENT_OUTCOME = /, (dropped|ignored|not shown|using "[^"]*")$/;

// The raw JSON editor: replaces the whole document.
export async function updateCharacterSheet(
  _previous: CharacterSheetFormState,
  formData: FormData,
): Promise<CharacterSheetFormState> {
  let config: unknown;
  try {
    config = JSON.parse(formText(formData, "config"));
  } catch (error) {
    return { error: `This isn't valid JSON: ${(error as Error).message}` };
  }
  if (!isObject(config)) return { error: "The config must be a JSON object." };
  const result = await saveConfig(config);
  // Re-reads the saved copy, so the on-load notices (unknown keys, dead
  // anchors) describe what's stored now, not what was stored at page load.
  // The textarea is uncontrolled, so its text stays.
  if (result && "saved" in result) refresh();
  return result;
}

// The structured form: changes one job's form fields in the saved copy
// (loadSavedConfig) and saves the result.
export async function updateCharacterJob(
  jobId: string,
  _previous: CharacterSheetFormState,
  formData: FormData,
): Promise<CharacterSheetFormState> {
  const loaded = await loadSavedConfig();
  if ("error" in loaded) return loaded;
  const { config } = loaded;

  const job = findJob(savedJobs(config), jobId);
  if (!job) return jobGone(jobId);
  const conflict = applyJobForm(job, formData);
  if (conflict) return { error: conflict };
  const result = await saveConfig(config);
  // Re-renders the page from the saved copy, so a slot just filled counts
  // as filled: sending "fill" for it again would be refused as a conflict.
  // Typed values stay, since the form's inputs are uncontrolled.
  if (result && "saved" in result) refresh();
  return result;
}

// Adds a job as a copy of an existing one (level, portrait, slots,
// sections), so it starts complete and the form only has to change what
// differs. Saved at once as a draft, whatever the copied job's status, so
// it stays off the home page until its form sets it to published. The id's
// format and the job limit are checked by saveConfig.
export async function addCharacterJob(
  _previous: CharacterSheetFormState,
  formData: FormData,
): Promise<CharacterSheetFormState> {
  const id = formText(formData, "id");
  const copyFrom = formText(formData, "copy_from");
  const loaded = await loadSavedConfig();
  if ("error" in loaded) return loaded;
  const { config } = loaded;

  const jobs = savedJobs(config);
  if (findJob(jobs, id)) return { error: `A job with the id "${id}" already exists.` };
  const source = findJob(jobs, copyFrom);
  if (!source) return jobGone(copyFrom);

  // id first, as in the bundled file; spreading keeps the rest in order.
  const job = {
    ...structuredClone(source),
    id,
    name: formText(formData, "name"),
    title: formText(formData, "title"),
    status: "draft",
  };
  config.jobs = [...jobs, job];
  const result = await saveConfig(config);
  if (!result || "error" in result) return result;
  redirect(`/admin/character-sheet?job=${encodeURIComponent(id)}`);
}

// Makes another job the one / shows with no ?job=. Only defaultJobId
// changes; re-rendered afterwards, so the form's summary names the new
// default.
export async function setDefaultCharacterJob(
  _previous: CharacterSheetFormState,
  formData: FormData,
): Promise<CharacterSheetFormState> {
  const jobId = formText(formData, "job_id");
  const loaded = await loadSavedConfig();
  if ("error" in loaded) return loaded;
  const { config } = loaded;

  if (!findJob(savedJobs(config), jobId)) return jobGone(jobId);
  config.defaultJobId = jobId;
  const result = await saveConfig(config);
  if (result && "saved" in result) refresh();
  return result;
}

// Removes a job from the saved copy; nothing else in the document
// changes. A job already gone (removed in another tab or as JSON) counts
// as removed: same end state, so it redirects without saving, as stale
// "empty" ids are ignored. The default job is refused rather than picking
// a new default here: it's what / shows, so changing it is a deliberate
// choice, made with the default job form first. That also keeps the last
// job, which has to be the default.
export async function removeCharacterJob(
  jobId: string,
  _previous: CharacterSheetFormState,
  _formData: FormData,
): Promise<CharacterSheetFormState> {
  const loaded = await loadSavedConfig();
  if ("error" in loaded) return loaded;
  const { config } = loaded;

  const removedHref = `/admin/character-sheet?${new URLSearchParams({ removed: jobId })}`;
  const jobs = savedJobs(config);
  if (!findJob(jobs, jobId)) redirect(removedHref);
  if (config.defaultJobId === jobId) {
    return {
      error: `Not removed: "${jobId}" is the default job, shown at / with no ?job=. Make another job the default first.`,
    };
  }

  // Entries that aren't objects stay as they are, for saveConfig to name.
  config.jobs = jobs.filter((entry) => !(isObject(entry) && entry.id === jobId));
  const result = await saveConfig(config);
  if (!result || "error" in result) return result;
  redirect(removedHref);
}

// The document the job actions edit. Read at save time rather than sent
// from the page, so whatever the form doesn't show (slots, other jobs, an
// edit made in the JSON editor since this page loaded) is kept as it is.
// Only a 404 (nothing saved yet) starts from the bundled file, as on the
// page. Patching the bundled file after a failed read would save it over
// the real copy.
async function loadSavedConfig(): Promise<{ config: JsonObject } | { error: string }> {
  const result = await adminRequest((api) => api.GET("/character-sheet"));
  if (!result) return { error: SERVER_UNREACHABLE };
  const { data, response } = result;
  if (data) return { config: data.config };
  // A copy, because the imported module is shared by every request.
  if (response.status === 404) return { config: structuredClone(bundledConfig) };
  return { error: `Not saved: reading the saved copy failed (HTTP ${response.status}).` };
}

// The saved copy's jobs, entries that aren't objects included (saveConfig
// names those).
function savedJobs(config: JsonObject): unknown[] {
  return Array.isArray(config.jobs) ? config.jobs : [];
}

function findJob(jobs: unknown[], id: string): JsonObject | undefined {
  return jobs.find((entry): entry is JsonObject => isObject(entry) && entry.id === id);
}

// For a job removed (in another tab or as JSON) since the page loaded.
function jobGone(id: string): { error: string } {
  return { error: `The saved copy has no job "${id}" any more. Reload the page.` };
}

// Writes the form's fields into the job in place. Empty optional fields
// remove their key, so the panel falls back to its default. Returns a
// message if the saved copy changed in a way the form can't merge.
function applyJobForm(job: JsonObject, formData: FormData): string | null {
  const text = (name: string) => formText(formData, name);
  job.name = text("name");
  job.title = text("title");
  // Absent means published, so the key is only written for the others,
  // like the bundled file. A default job made a draft is refused by
  // saveConfig.
  const status = text("status");
  if (status === "published") delete job.status;
  else job.status = status;
  setOrDelete(job, "icon", text("icon"));
  job.level = { ...asObject(job.level), label: text("level_label"), value: text("level_value") };

  const src = text("portrait_src");
  if (src) {
    const portrait = { ...asObject(job.portrait) };
    // width and height describe the old image, not a new one.
    if (portrait.src !== src) {
      delete portrait.width;
      delete portrait.height;
    }
    job.portrait = { ...portrait, src, alt: text("portrait_alt"), framing: text("portrait_framing") };
  } else {
    delete job.portrait;
  }

  // Markdown, so not trimmed (leading indentation can matter), but blank
  // means no section. Line endings arrive as \r\n from the browser; \n
  // matches the bundled file, so an unchanged section doesn't differ.
  const sections = { ...asObject(job.sections) };
  for (const [name, value] of formData) {
    if (!name.startsWith("section.") || typeof value !== "string") continue;
    setOrDelete(sections, name.slice("section.".length), value.trim() ? value.replace(/\r\n/g, "\n") : "");
  }
  if (Object.keys(sections).length > 0) job.sections = sections;
  else delete job.sections;

  // Slots the form showed filled: only those the saved copy still fills,
  // so a slot emptied as JSON since the page loaded stays empty.
  const slots = asObject(job.slots);
  const fill = formData.getAll("fill").map(String);
  const empty = formData.getAll("empty").map(String);
  // The form can't send both, but a Server Action can be posted directly.
  const both = fill.find((slotId) => empty.includes(slotId));
  if (both) return `The slot "${both}" can't be both filled and emptied.`;
  for (const [slotId, content] of Object.entries(slots)) {
    // Emptied with the form's button. This wins over any JSON edit to the
    // slot made since the page loaded, because removing it is the stated
    // intent. An id the saved copy no longer fills is never reached here.
    if (empty.includes(slotId)) {
      delete slots[slotId];
      continue;
    }
    if (!isObject(content)) continue;
    // Filled as JSON since the page loaded: neither copy wins silently.
    if (fill.includes(slotId)) return `The slot "${slotId}" was filled since this page loaded. Reload the page.`;
    if (!formData.has(`tooltip.${slotId}.title`)) continue;
    content.tooltip = applyTooltipForm(asObject(content.tooltip), formData, `tooltip.${slotId}.`);
    if (formData.has(`action.${slotId}.kind`)) {
      content.action = applyActionForm(asObject(content.action), formData, `action.${slotId}.`);
    }
  }
  // Slots filled with the form's button. An id the config has no slot for
  // is caught by saveConfig, like any other job naming one.
  for (const slotId of fill) {
    slots[slotId] = {
      tooltip: applyTooltipForm({}, formData, `tooltip.${slotId}.`),
      action: applyActionForm({}, formData, `action.${slotId}.`),
    };
  }
  job.slots = slots;
  return null;
}

// One slot's action. A kind the saved action already has keeps its other
// keys; a new kind starts clean, so no field of the old kind lingers.
function applyActionForm(saved: JsonObject, formData: FormData, prefix: string): JsonObject {
  const text = (name: string) => formText(formData, prefix + name);
  const kind = text("kind");
  const action: JsonObject = saved.kind === kind ? { ...saved } : { kind };
  if (kind === "anchor") {
    // The help text says without the #, but it's an easy slip.
    action.target = text("target").replace(/^#/, "");
  } else if (kind === "link" || kind === "external") {
    action.href = text("href");
  } else if (kind === "param") {
    // An empty name or value is written as it is, so saveConfig names it.
    action.name = text("name");
    action.value = text("value");
    setOrDelete(action, "target", text("target").replace(/^#/, ""));
  }
  if (kind === "external" && formData.has(`${prefix}new_tab`)) action.newTab = true;
  else delete action.newTab;
  return action;
}

// One slot's tooltip fields, over the saved tooltip so keys the form
// doesn't show survive. Half-filled stats and items are written as they
// are, so saveConfig names the missing half instead of it vanishing.
function applyTooltipForm(saved: JsonObject, formData: FormData, prefix: string): JsonObject {
  const text = (name: string) => formText(formData, prefix + name);
  const tooltip: JsonObject = { ...saved, title: text("title") };

  const tags = text("tags")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (tags.length > 0) tooltip.tags = tags;
  else delete tooltip.tags;

  setOrDelete(tooltip, "subtitle", text("subtitle"));
  setOrDelete(tooltip, "note", text("note"));

  const stat = { label: text("stat_label"), value: text("stat_value") };
  if (stat.label || stat.value) tooltip.stat = stat;
  else delete tooltip.stat;

  // Paired by position: the editor sends one label and one value per row.
  // An empty label makes a plain line; a fully empty row is skipped.
  const labels = formData.getAll(`${prefix}item_label`).map((label) => String(label).trim());
  const values = formData.getAll(`${prefix}item_value`).map((value) => String(value).trim());
  const items = values.flatMap((value, index) => {
    const label = labels[index] ?? "";
    if (!label && !value) return [];
    return [label ? { label, value } : value];
  });
  if (items.length > 0) tooltip.items = items;
  else delete tooltip.items;

  return tooltip;
}

// Strict, like the bundled file's build-time check in lib/character.ts.
// The backend's JSON Schema can't see duplicate ids, a job naming a slot
// that doesn't exist, or a defaultJobId with no job; saved anyway, those
// would make the home page quietly drop a job or fall back.
async function saveConfig(config: JsonObject): Promise<CharacterSheetFormState> {
  const { config: parsed, errors } = parseConfig(config);
  if (!parsed || errors.length > 0) {
    return {
      error: "Not saved. Fix these problems first:",
      problems: errors.map((error) => error.replace(LENIENT_OUTCOME, "")),
    };
  }

  // Keys the schema doesn't have, listed by full path like the on-load
  // notice. The backend's JSON Schema refuses them too; this answers
  // first, in similar words. Most are typos of optional fields (a typo in
  // a required one already fails above), which the site would silently
  // leave out. The form can't show them, hence the JSON editor.
  const unknownKeys = findUnknownKeys(config, parsed);
  if (unknownKeys.length > 0) {
    return {
      error:
        "Not saved. These keys aren't in the schema (typos?). Remove them, in the JSON editor if the form doesn't show them:",
      problems: unknownKeys,
    };
  }

  // The document as written, not zod's parsed copy, which would drop keys
  // and fill in defaults the editor doesn't show.
  const body = { config: config as Record<string, components["schemas"]["JsonValue"]> };
  const result = await adminRequest((api) => api.PUT("/character-sheet", { body }));
  if (!result) return { error: SERVER_UNREACHABLE };
  const { response, error } = result;
  if (error) return describeRejection(response, error);
  // Every action here saves through this function, before any redirect.
  revalidatePublic(CACHE_TAGS.characterSheet);
  return {
    saved: JSON.stringify(config),
    deadAnchors: findDeadAnchors(parsed),
    deadParams: findDeadParams(parsed),
  };
}

// The backend's 422 items carry the full path ["body", "config", "jobs", 1,
// ...], and the last segment alone ("title") doesn't say which job. The 413
// detail is a sentence naming the size limit.
function describeRejection(response: Response, error: unknown): CharacterSheetFormState {
  const detail = (error as { detail?: unknown }).detail;
  if (response.status === 422 && Array.isArray(detail)) {
    const items = detail as components["schemas"]["ValidationError"][];
    return {
      error: "The server rejected the config:",
      problems: items.map((item) => `${item.loc.slice(2).join(".") || "(root)"}: ${item.msg}`),
    };
  }
  if (typeof detail === "string") return { error: detail };
  return { error: describeSaveFailure(response, error) };
}

function setOrDelete(target: JsonObject, key: string, value: string) {
  if (value) target[key] = value;
  else delete target[key];
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}
