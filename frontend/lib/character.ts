import { parseConfig } from "@/components/character-sheet/parse";
import rawConfig from "./character-config.json";

// The home page's character sheet: jobs (target industries), their slots,
// and the per-job section text. Edit character-config.json; the JSON
// Schema next to the component gives editors autocomplete.
//
// The bundled file is checked strictly: any problem, even one parseConfig
// could recover from, fails the build here instead of quietly dropping a
// job in production. Lenient parsing is for remote sources (admin API,
// CMS) added later through loadConfig(), with this file as the fallback.
const { config, errors } = parseConfig(rawConfig);
if (!config || errors.length > 0) {
  throw new Error(`lib/character-config.json is invalid:\n${errors.join("\n")}`);
}

export const characterConfig = config;
