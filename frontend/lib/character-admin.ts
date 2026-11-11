import "server-only";
import { findUnknownKeys, parseConfig } from "@solution-nine/wol-character-panel";
import { adminApi } from "./admin-api";
import { findDeadAnchors, findDeadParams } from "./character-anchors";
import bundledConfig from "./character-config.json";

// The character sheet as the admin pages edit it. Not getCharacterConfig():
// it falls back to the bundled file on a timeout or error, and saving that
// fallback would overwrite the real copy. Only a 404 (nothing saved yet)
// starts from the bundled file; anything else throws to
// app/admin/error.tsx. GET is public, but adminApi() still checks the
// session before an editor is shown.
export async function loadCharacterSheetForAdmin() {
  const api = await adminApi();
  const { data, response } = await api.GET("/character-sheet");
  if (!data && response.status !== 404) {
    throw new Error(`Loading the character sheet failed (HTTP ${response.status})`);
  }

  const config = data?.config ?? bundledConfig;
  const parsed = parseConfig(config);
  // Unknown keys, dead anchors and dead params below stay flagged on every
  // load, not just on the save that made them. Skipped while the stored
  // copy has errors: its jobs wouldn't line up.
  const clean = parsed.errors.length === 0 ? parsed.config : null;
  return {
    // As stored, unknown keys included.
    config,
    parsed,
    // Compact JSON, compared by describeStoredCopy(); stored is null
    // before the first save.
    bundled: JSON.stringify(bundledConfig),
    stored: data ? JSON.stringify(data.config) : null,
    unknownKeys: clean ? findUnknownKeys(config, clean) : [],
    deadAnchors: clean ? findDeadAnchors(clean) : [],
    deadParams: clean ? findDeadParams(clean) : [],
  };
}
