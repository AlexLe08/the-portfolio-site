"use server";

import { parseConfig } from "@/components/character-sheet/parse";
import { adminRequest } from "@/lib/admin-api";
import type { components } from "@/lib/api-types";
import { formText } from "@/lib/form-data";
import { describeSaveFailure, SERVER_UNREACHABLE } from "@/lib/messages";

// problems lists every issue by path, so a long document can be fixed in
// one pass. A save returns the document it stored as compact JSON, so the
// editor can compare it with the bundled file without re-fetching.
export type CharacterSheetFormState =
  | { error: string; problems?: string[] }
  | { saved: string }
  | null;

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
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return { error: "The config must be a JSON object." };
  }

  // Strict, like the bundled file's build-time check in lib/character.ts.
  // The backend's JSON Schema can't see duplicate ids, a job naming a slot
  // that doesn't exist, or a defaultJobId with no job; saved anyway, those
  // would make the home page quietly drop a job or fall back.
  const { errors } = parseConfig(config);
  if (errors.length > 0) {
    return { error: "Not saved. Fix these problems first:", problems: errors };
  }

  // The document as written, not zod's parsed copy, which drops unknown
  // keys: a typo should stay visible in the editor, not vanish on save.
  const body = { config: config as Record<string, components["schemas"]["JsonValue"]> };
  // adminRequest() checks the session: Server Actions can be POSTed to
  // directly, without the page that renders the form.
  const result = await adminRequest((api) => api.PUT("/character-sheet", { body }));
  if (!result) return { error: SERVER_UNREACHABLE };
  const { response, error } = result;
  if (error) return describeRejection(response, error);
  return { saved: JSON.stringify(config) };
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
