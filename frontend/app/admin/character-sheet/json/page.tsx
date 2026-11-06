import { updateCharacterSheet } from "../actions";
import { CharacterSheetEditor } from "@/components/CharacterSheetEditor";
import { Sheet } from "@/components/Sheet";
import { loadCharacterSheetForAdmin } from "@/lib/character-admin";

export const metadata = {
  title: "Character sheet JSON",
};

// Everything the form doesn't cover, such as which job is the default
// and keys the form has no field for.
export default async function AdminCharacterSheetJsonPage() {
  const { config, bundled, stored, unknownKeys, deadAnchors } = await loadCharacterSheetForAdmin();
  return (
    <Sheet title="Character sheet JSON" back={{ href: "/admin/character-sheet", label: "Character sheet" }}>
      <CharacterSheetEditor
        action={updateCharacterSheet}
        value={JSON.stringify(config, null, 2)}
        bundled={bundled}
        stored={stored}
        unknownKeys={unknownKeys}
        deadAnchors={deadAnchors}
      />
    </Sheet>
  );
}
