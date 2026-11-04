import * as Sentry from "@sentry/nextjs";
import { cache } from "react";
import {
  findUnknownKeys,
  loadConfig,
  parseConfig,
  type ConfigSource,
} from "@/components/character-sheet/parse";
import type { CharacterSheetConfig } from "@/components/character-sheet/types";
import { api } from "./api";
import rawConfig from "./character-config.json";

// The home page's character sheet: jobs (target industries), their slots,
// and the per-job section text. Edit character-config.json; the JSON
// Schema next to the component gives editors autocomplete.
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

// The copy saved through PUT /character-sheet. Resolves to undefined when
// there's nothing to use: no save yet (404), or the backend is unreachable
// or timed out, which is logged but not reported, since every cold start
// would otherwise be a Sentry event. Anything else throws, so loadConfig
// reports it.
const apiSource: ConfigSource = {
  name: "GET /character-sheet",
  load: async () => {
    let result;
    try {
      result = await api.GET("/character-sheet", {
        signal: AbortSignal.timeout(CHARACTER_TIMEOUT_MS),
      });
    } catch (error) {
      console.error("Falling back to the bundled character sheet:", error);
      return undefined;
    }
    const { data, response } = result;
    if (data) return data.config;
    if (response.status === 404) return undefined;
    throw new Error(`HTTP ${response.status}`);
  },
};

// cache() memoizes per request, like getContent(). Never throws: on any
// problem the page shows the bundled file. Issues reaching onIssue (an HTTP
// error, or a saved copy that fails the zod schema, such as after the
// schema changed) are real bugs, so they go to Sentry.
export const getCharacterConfig = cache(
  (): Promise<CharacterSheetConfig> =>
    loadConfig([apiSource], characterConfig, ({ source, errors, error }) => {
      Sentry.captureException(error ?? new Error(`Character sheet from ${source} has problems`), {
        extra: { source, errors },
      });
    }),
);
