"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import type { CharacterSheetFormState } from "@/app/admin/character-sheet/actions";
import { CharacterSheetSaveStatus } from "@/components/CharacterSheetSaveStatus";
import { type SaveAction, useSaveAction } from "@/lib/use-save-action";

type Props = {
  // removeCharacterJob bound to the job's id, which goes to the default
  // job's form once it's saved.
  action: SaveAction<CharacterSheetFormState>;
  job: { id: string; name: string };
  // The default job can't be removed from the form (see actions.ts).
  isDefault: boolean;
};

// Removes the job being edited. Its own form, never nested in the job's
// form, and folded away like "Add a job": it's needed rarely. A plain
// button, since oxide is reserved for errors; the confirm is the guard.
export function CharacterJobRemoveForm({ action, job, isDefault }: Props) {
  const { state, pending, onSubmit } = useSaveAction(action);

  function confirmFirst(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Remove the job "${job.name}"? It disappears from the home page now. Its level, portrait, ` +
        `slots, and sections can't be restored from the form; copy it from the JSON editor first ` +
        `if you might want it back.`,
    );
    if (!confirmed) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  }

  return (
    <details className="form-more form-more--after">
      <summary>Remove this job</summary>
      {isDefault ? (
        <p className="form-help">
          {job.name} is the default job, shown at / with no ?job=, so it can&rsquo;t be removed
          here. To remove it, first pick another default job at the top of this page.
        </p>
      ) : (
        <form onSubmit={confirmFirst} className="form-group">
          <p className="form-help">
            Removes {job.name} from the saved copy straight away. To keep a copy, take it from the{" "}
            <Link href="/admin/character-sheet/json">JSON editor</Link> first.
          </p>

          <CharacterSheetSaveStatus state={state} pending={pending} />

          <div className="form-actions">
            <button type="submit" className="form-button" disabled={pending}>
              {pending ? "Removing…" : `Remove ${job.name}`}
            </button>
          </div>
        </form>
      )}
    </details>
  );
}
