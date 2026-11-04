"use server";

import { findUnknownKeys, parseConfig } from "@/components/character-sheet/parse";
import { adminRequest } from "@/lib/admin-api";
import type { components } from "@/lib/api-types";
import bundledConfig from "@/lib/character-config.json";
import { formText } from "@/lib/form-data";
import { describeSaveFailure, SERVER_UNREACHABLE } from "@/lib/messages";

// problems lists every issue by path, so a long document can be fixed in
// one pass. A save returns the document it stored as compact JSON, so the
// editor can compare it with the bundled file without re-fetching, and any
// keys the schema doesn't have, which are saved but ignored by the site.
export type CharacterSheetFormState =
  | { error: string; problems?: string[] }
  | { saved: string; unknownKeys: string[] }
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
  return saveConfig(config);
}

// The structured form: changes one job's form fields in the saved copy and
// saves the result. Read at save time rather than sent from the page, so
// whatever the form doesn't show (slots, other jobs, unknown keys, an edit
// made in the JSON editor since this page loaded) is kept as it is.
export async function updateCharacterJob(
  jobId: string,
  _previous: CharacterSheetFormState,
  formData: FormData,
): Promise<CharacterSheetFormState> {
  const loaded = await loadSavedConfig();
  if ("error" in loaded) return loaded;
  const { config } = loaded;

  const jobs = Array.isArray(config.jobs) ? config.jobs : [];
  const job = jobs.find((entry): entry is JsonObject => isObject(entry) && entry.id === jobId);
  if (!job) return { error: `The saved copy has no job "${jobId}" any more. Reload the page.` };
  applyJobForm(job, formData);
  return saveConfig(config);
}

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

// Writes the form's fields into the job in place. Empty optional fields
// remove their key, so the panel falls back to its default.
function applyJobForm(job: JsonObject, formData: FormData) {
  const text = (name: string) => formText(formData, name);
  job.name = text("name");
  job.title = text("title");
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
}

// Strict, like the bundled file's build-time check in lib/character.ts.
// The backend's JSON Schema can't see duplicate ids, a job naming a slot
// that doesn't exist, or a defaultJobId with no job; saved anyway, those
// would make the home page quietly drop a job or fall back.
async function saveConfig(config: JsonObject): Promise<CharacterSheetFormState> {
  const { config: parsed, errors } = parseConfig(config);
  if (errors.length > 0) {
    return {
      error: "Not saved. Fix these problems first:",
      problems: errors.map((error) => error.replace(LENIENT_OUTCOME, "")),
    };
  }

  // The document as written, not zod's parsed copy, which drops unknown
  // keys: a typo should stay visible in the editor, not vanish on save.
  // Unknown keys are reported after saving rather than blocking it: a typo
  // in a required field already fails above as missing, so these can only
  // be optional fields the panel leaves out.
  const body = { config: config as Record<string, components["schemas"]["JsonValue"]> };
  // adminRequest() checks the session: Server Actions can be POSTed to
  // directly, without the page that renders the form.
  const result = await adminRequest((api) => api.PUT("/character-sheet", { body }));
  if (!result) return { error: SERVER_UNREACHABLE };
  const { response, error } = result;
  if (error) return describeRejection(response, error);
  return { saved: JSON.stringify(config), unknownKeys: findUnknownKeys(config, parsed) };
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
