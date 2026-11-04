import { updateCharacterSheet } from "./actions";
import { findUnknownKeys, parseConfig } from "@/components/character-sheet/parse";
import { CharacterSheetEditor } from "@/components/CharacterSheetEditor";
import { Sheet } from "@/components/Sheet";
import { adminApi } from "@/lib/admin-api";
import bundledConfig from "@/lib/character-config.json";

export const metadata = {
  title: "Character sheet",
};

export default async function AdminCharacterSheetPage() {
  // Not getCharacterConfig(): it falls back to the bundled file on a
  // timeout or error, and saving that fallback would overwrite the real
  // copy. Only a 404 (nothing saved yet) starts from the bundled file;
  // anything else throws to app/admin/error.tsx. GET is public, but
  // adminApi() still checks the session before showing the editor.
  const api = await adminApi();
  const { data, response } = await api.GET("/character-sheet");
  if (!data && response.status !== 404) {
    throw new Error(`Loading the character sheet failed (HTTP ${response.status})`);
  }

  const config = data?.config ?? bundledConfig;
  // Typos saved earlier stay flagged, not just on the save that made them.
  // Skipped if the stored copy has errors: its jobs wouldn't line up.
  const parsed = parseConfig(config);
  const unknownKeys = parsed.errors.length === 0 ? findUnknownKeys(config, parsed.config) : [];
  return (
    <Sheet title="Character sheet" back={{ href: "/admin", label: "Admin" }}>
      <CharacterSheetEditor
        action={updateCharacterSheet}
        value={JSON.stringify(config, null, 2)}
        bundled={JSON.stringify(bundledConfig)}
        stored={data ? JSON.stringify(data.config) : null}
        unknownKeys={unknownKeys}
      />
    </Sheet>
  );
}
