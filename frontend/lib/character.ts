import * as Sentry from "@sentry/nextjs";
import { cache } from "react";
import {
  findUnknownKeys,
  loadConfig,
  parseConfig,
  publicConfig,
  type CharacterSheetConfig,
  type ConfigSource,
} from "@alexle08/eorzean-character-sheet";
import { api } from "./api";
import rawConfig from "./character-config.json";

// The home page's character sheet: jobs (target industries), their slots,
// and the per-job section text. Edit character-config.json; the JSON
// Schema in packages/eorzean-character-sheet gives editors autocomplete.
//
// The bundled file is checked strictly: any problem, even one parseConfig
// could recover from, fails the build here instead of quietly dropping a
// job in production. Saved copies from the admin API are parsed leniently
// by getCharacterConfig(), with this file as the fallback.
const { config, errors } = parseConfig(rawConfig);
if (!config || errors.length > 0) {
  throw new Error(`lib/character-config.json is invalid:\n${errors.join("\n")}`);
}
// Unknown keys too (likely typos the panel would leave out). The admin
// editor only warns about them; this file is fixed before it ships.
const unknownKeys = findUnknownKeys(rawConfig, config);
if (unknownKeys.length > 0) {
  throw new Error(`lib/character-config.json has unknown keys:\n${unknownKeys.join("\n")}`);
}

export const characterConfig: CharacterSheetConfig = config;

// Same reasoning as CONTENT_TIMEOUT_MS in lib/content.ts: the bundled file
// is a fine stand-in, so a cold backend never holds the page.
const CHARACTER_TIMEOUT_MS = 5000;

// Thrown when the backend is unreachable or timed out (a Render cold
// start). It counts as a failed load, so the page says it shows the bundled
// file, but it's logged rather than reported: every cold start would
// otherwise be a Sentry event.
class BackendUnavailable extends Error {}

// The copy saved through PUT /character-sheet. Resolves to undefined only
// when nothing is saved yet (404); any other failure throws, so loadConfig
// lists it as an issue.
const apiSource: ConfigSource = {
  name: "GET /character-sheet",
  load: async () => {
    let result;
    try {
      result = await api.GET("/character-sheet", {
        signal: AbortSignal.timeout(CHARACTER_TIMEOUT_MS),
      });
    } catch (error) {
      throw new BackendUnavailable("Backend unreachable", { cause: error });
    }
    const { data, response } = result;
    if (data) return data.config;
    if (response.status === 404) return undefined;
    throw new Error(`HTTP ${response.status}`);
  },
};

export type CharacterConfigResult = {
  config: CharacterSheetConfig;
  // True when the bundled file is showing because loading the saved copy
  // failed, not because nothing is saved. Pages pass it to FallbackNotice.
  fallback: boolean;
};

// cache() memoizes per request, like getContent(). Never throws: on any
// problem the page shows the bundled file. Issues other than an unreachable
// backend (an HTTP error, or a saved copy that fails the zod schema, such
// as after the schema changed) are real bugs, so they go to Sentry.
// Visitors' view: draft and hidden jobs are left out (publicConfig).
export const getCharacterConfig = cache(async (): Promise<CharacterConfigResult> => {
  const { config, source, issues } = await loadConfig([apiSource], characterConfig);
  for (const { source, errors, error } of issues) {
    if (error instanceof BackendUnavailable) {
      console.error("Falling back to the bundled character sheet:", error.cause);
      continue;
    }
    Sentry.captureException(error ?? new Error(`Character sheet from ${source} has problems`), {
      extra: { source, errors },
    });
  }
  return { config: publicConfig(config), fallback: source === null && issues.length > 0 };
});
