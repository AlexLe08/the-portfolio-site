"use client";

import type { CharacterSheetFormState } from "@/app/admin/character-sheet/actions";
import { CharacterSheetSaveStatus } from "@/components/CharacterSheetSaveStatus";
import { type SaveAction, useSaveAction } from "@/lib/use-save-action";

type Props = {
  // updateCharacterWindowText, which re-renders the page once it's saved.
  action: SaveAction<CharacterSheetFormState>;
  characterName?: string;
  // The shared gear set's caption.
  gearSetLabel?: string;
  gearSetValue?: string;
  // From the package's LIMITS.
  limits: { characterName: number; label: number; value: number };
};

// Settings of the whole window rather than of one job, so one form for the
// page, folded away like the default job. Tabs, blocks and the gear set's
// links are edited as JSON.
export function CharacterWindowTextForm({ action, characterName, gearSetLabel, gearSetValue, limits }: Props) {
  const { state, pending, onSubmit } = useSaveAction(action);

  return (
    <details className="form-more">
      <summary>Name and gear-set caption</summary>
      <form onSubmit={onSubmit} className="form-group">
        <div className="form-field">
          <label htmlFor="character-name" className="form-label">
            Character name
          </label>
          <input
            id="character-name"
            name="character_name"
            defaultValue={characterName}
            maxLength={limits.characterName}
            aria-describedby="character-name-help"
            className="form-input"
          />
          <p id="character-name-help" className="form-help">
            At the right of the window&rsquo;s top bar, for example: Alex Le. Empty shows no name.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="gear-set-label" className="form-label">
            Caption, small line
          </label>
          <input
            id="gear-set-label"
            name="gear_set_label"
            defaultValue={gearSetLabel}
            maxLength={limits.label}
            aria-describedby="gear-set-help"
            className="form-input"
          />
        </div>

        <div className="form-field">
          <label htmlFor="gear-set-value" className="form-label">
            Caption, larger line
          </label>
          <input
            id="gear-set-value"
            name="gear_set_value"
            defaultValue={gearSetValue}
            maxLength={limits.value}
            aria-describedby="gear-set-help"
            className="form-input"
          />
          <p id="gear-set-help" className="form-help">
            The caption in the gear-set row, next to the job menu, for example: Status, Open to
            opportunities. A job with its own gear set (set as JSON) shows that one instead.
          </p>
        </div>

        <CharacterSheetSaveStatus state={state} pending={pending} />

        <div className="form-actions">
          <button type="submit" className="form-button" disabled={pending}>
            {pending ? "Saving…" : "Save name and caption"}
          </button>
        </div>
      </form>
    </details>
  );
}
