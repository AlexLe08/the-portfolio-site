import "server-only";
import { findUnknownKeys, parseConfig } from "@alexle08/eorzean-character-sheet";
import { adminApi } from "./admin-api";
import { findDeadAnchors } from "./character-anchors";
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
  return {
    // As stored, unknown keys included.
    config,
    parsed,
    // Compact JSON, compared by describeStoredCopy(); stored is null
    // before the first save.
    bundled: JSON.stringify(bundledConfig),
    stored: data ? JSON.stringify(data.config) : null,
    // Typos saved earlier stay flagged, not just on the save that made
    // them. Skipped if the stored copy has errors: its jobs wouldn't line up.
    unknownKeys: parsed.errors.length === 0 ? findUnknownKeys(config, parsed.config) : [],
    // Likewise for anchors to sections the home page doesn't render.
    deadAnchors: parsed.config && parsed.errors.length === 0 ? findDeadAnchors(parsed.config) : [],
  };
}
