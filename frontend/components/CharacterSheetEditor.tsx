"use client";

import type { CharacterSheetFormState } from "@/app/admin/character-sheet/actions";
import { SaveStatus } from "@/components/SaveStatus";
import { StatusMessage } from "@/components/StatusMessage";
import { useSaveAction } from "@/lib/use-save-action";

type Props = {
  action: (state: CharacterSheetFormState, formData: FormData) => Promise<CharacterSheetFormState>;
  // The document to start from, pretty-printed.
  value: string;
  // Compact JSON of lib/character-config.json and of the saved copy (null
  // before the first save), compared to explain what the site shows.
  bundled: string;
  stored: string | null;
  // Keys in the stored copy that the schema doesn't have (see
  // findUnknownKeys); a save replaces them with its own list.
  unknownKeys: string[];
};

// The whole config as raw JSON, matching PUT /character-sheet, which
// replaces the document. The structured form for common edits is PR 3.
export function CharacterSheetEditor({ action, value, bundled, stored, unknownKeys }: Props) {
  const { state, pending, onSubmit } = useSaveAction(action);

  // After a save the page isn't re-fetched, so use what was just saved.
  const lastSave = state && "saved" in state ? state : null;
  const current = lastSave ? lastSave.saved : stored;
  const ignoredKeys = lastSave ? lastSave.unknownKeys : unknownKeys;
  let note;
  if (current === null) {
    note = "Not saved yet: the site shows lib/character-config.json, which this starts from.";
  } else if (current !== bundled) {
    note =
      "Differs from lib/character-config.json, which shows during outages. Update it there too.";
  }

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

      {/* The list goes inside the alert, so it's read out with the error. */}
      {state && "problems" in state && state.problems ? (
        <StatusMessage tone="error">
          {state.error}
          <ul className="json-editor__problems">
            {state.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </StatusMessage>
      ) : (
        <SaveStatus state={state} pending={pending} />
      )}
      {/* Saved anyway: the panel just leaves these out (see actions.ts). */}
      {ignoredKeys.length > 0 && !pending && (
        <StatusMessage tone="info">
          The site ignores these keys, which the schema doesn&rsquo;t have. Typos?
          <ul className="json-editor__problems">
            {ignoredKeys.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </StatusMessage>
      )}

      <div className="form-actions">
        <button type="submit" className="form-button" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
