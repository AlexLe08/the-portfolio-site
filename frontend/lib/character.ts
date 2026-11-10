import * as Sentry from "@sentry/nextjs";
import { cache } from "react";
import {
  findUnknownKeys,
  loadConfig,
  parseConfig,
  publicConfig,
  type CharacterSheetConfig,
  type ConfigSource,
} from "@solution-nine/wol-character-panel";
import { unstable_cache } from "next/cache";
import { api, apiBaseUrl } from "./api";
import { CACHE_TAGS, CACHE_VERSION, PUBLIC_REVALIDATE_SECONDS } from "./cache-tags";
import rawConfig from "./character-config.json";

// The home page's character sheet: jobs (target industries), their slots,
// and the per-job section text. Edit character-config.json; the JSON
// Schema the package ships (installed at the repo root) gives editors
// autocomplete.
//
// The bundled file is checked strictly: any problem, even one parseConfig
// could recover from, fails the build here instead of quietly dropping a
// job in production. Saved copies from the admin API are parsed leniently
// by getCharacterConfig(), with this file as the fallback.
const { config, errors } = parseConfig(rawConfig);
if (!config || errors.length > 0) {
  throw new Error(`lib/character-config.json is invalid:\n${errors.join("\n")}`);
}
// Unknown keys too (likely typos the panel would leave out), which admin
// saves refuse as well.
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

// The copy saved through PUT /character-sheet, unparsed. Resolves to null
// only when nothing is saved yet (404), which is a real answer and gets
// cached like one (null rather than undefined, so it survives the cache's
// JSON round trip as itself). Any other failure throws, so unstable_cache
// below only ever stores good data. Nothing is reported here: on a miss the
// error reaches getCharacterConfig(), which reports it, and a failed
// background refresh only keeps the old copy.
export async function fetchSavedCharacterConfig(): Promise<unknown> {
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
  if (response.status === 404) return null;
  throw new Error(`HTTP ${response.status}`);
}

// Shared between requests through Next's data cache, like cachedContent in
// lib/content.ts (tag CACHE_TAGS.characterSheet). apiBaseUrl is in the key
// because the fetch reads it from its closure.
const cachedSavedConfig = unstable_cache(
  fetchSavedCharacterConfig,
  ["character-sheet", apiBaseUrl, CACHE_VERSION],
  { tags: [CACHE_TAGS.characterSheet], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

// Resolves to undefined only when nothing is saved yet; any failure throws,
// so loadConfig lists it as an issue. Parsing happens in loadConfig, outside
// the cache.
const apiSource: ConfigSource = {
  name: "GET /character-sheet",
  load: async () => (await cachedSavedConfig()) ?? undefined,
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
