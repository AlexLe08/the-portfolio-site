"use client";

import type { MediaFormState } from "@/app/admin/media/actions";
import { SaveStatus } from "@/components/SaveStatus";
import { ALT_TEXT_MAX_LENGTH } from "@/lib/media-rules";
import { useSaveAction } from "@/lib/use-save-action";

type Props = {
  // updateAltText bound to this image's id.
  action: (state: MediaFormState, formData: FormData) => Promise<MediaFormState>;
  id: number;
  altText: string;
};

export function MediaAltTextForm({ action, id, altText }: Props) {
  const { state, pending, onSubmit } = useSaveAction(action);
  const inputId = `alt-${id}`;

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor={inputId} className="form-label">
        Alt text
      </label>
      <input
        id={inputId}
        name="alt_text"
        required
        maxLength={ALT_TEXT_MAX_LENGTH}
        defaultValue={altText}
        aria-describedby={`${inputId}-help`}
        className="form-input"
      />
      <p id={`${inputId}-help`} className="form-help">
        Markdown already pasted into content keeps the old text; copy the line below again.
      </p>

      <SaveStatus state={state} pending={pending} />

      <div className="form-actions">
        <button type="submit" className="form-button" disabled={pending}>
          {pending ? "Saving…" : "Save alt text"}
        </button>
      </div>
    </form>
  );
}
