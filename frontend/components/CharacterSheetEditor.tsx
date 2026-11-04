"use client";

import type { CharacterSheetFormState } from "@/app/admin/character-sheet/actions";
import { CharacterSheetSaveStatus, describeStoredCopy } from "@/components/CharacterSheetSaveStatus";
import { useSaveAction } from "@/lib/use-save-action";

type Props = {
  action: (state: CharacterSheetFormState, formData: FormData) => Promise<CharacterSheetFormState>;
  // The document to start from, pretty-printed.
  value: string;
  // Compact JSON of lib/character-config.json and of the saved copy (null
  // before the first save), compared to explain what the site shows.
  bundled: string;
  stored: string | null;
  unknownKeys: string[];
};

// The whole config as raw JSON, matching PUT /character-sheet, which
// replaces the document. CharacterJobForm covers the common edits.
export function CharacterSheetEditor({ action, value, bundled, stored, unknownKeys }: Props) {
  const { state, pending, onSubmit } = useSaveAction(action);
  const note = describeStoredCopy(state && "saved" in state ? state.saved : stored, bundled);

  return (
    <form onSubmit={onSubmit}>
      <div className="form-field">
        <label htmlFor="config" className="form-label">
          Config (JSON)
        </label>
        <textarea
          id="config"
          name="config"
          required
          rows={30}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          defaultValue={value}
          aria-describedby="config-help"
          className="form-input form-textarea json-editor"
        />
        <p id="config-help" className="form-help">
          Checked against the same rules as the bundled file before saving.
          {note && ` ${note}`}
        </p>
      </div>

      <CharacterSheetSaveStatus state={state} pending={pending} unknownKeys={unknownKeys} />

      <div className="form-actions">
        <button type="submit" className="form-button" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
