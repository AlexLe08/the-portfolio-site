"use client";

import type { ContentFormState } from "@/app/admin/content/actions";
import { SaveStatus } from "@/components/SaveStatus";
import { useSaveAction } from "@/lib/use-save-action";

type Props = {
  // updateContent bound to this key.
  action: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  contentKey: string;
  description: string;
  value: string;
  fallback: string;
  // False when the key has no row yet and the site shows the fallback.
  isSet: boolean;
};

// One form per key, matching PUT /content/{key}: each save stands alone,
// so a failure can never leave it unclear which values were saved.
export function ContentField({ action, contentKey, description, value, fallback, isSet }: Props) {
  const { state, pending, onSubmit } = useSaveAction(action);
  const id = `content-${contentKey.replaceAll(".", "-")}`;
  const markdown = contentKey.endsWith("intro");
  const multiline = markdown || fallback.length > 60;

  // After a save the page isn't re-fetched, so compare against what was
  // just saved rather than the value the page loaded with.
  const saved = state && "saved" in state ? state.saved : undefined;
  const current = saved ?? value;
  const notes = [];
  if (!isSet && saved === undefined) {
    notes.push("Not saved yet: the site shows this built-in text.");
  } else if (current !== fallback) {
    notes.push("Differs from the built-in text in lib/content.ts, which shows during outages. Update it there too.");
  }

  return (
    <form onSubmit={onSubmit} className="content-field">
      <label htmlFor={id} className="form-label">
        <span className="content-field__key">{contentKey}</span> {description}
        {markdown && " (markdown)"}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name="value"
          required
          rows={markdown ? 6 : 3}
          defaultValue={value}
          aria-describedby={notes.length ? `${id}-notes` : undefined}
          className="form-input form-textarea"
        />
      ) : (
        <input
          id={id}
          name="value"
          required
          defaultValue={value}
          aria-describedby={notes.length ? `${id}-notes` : undefined}
          className="form-input"
        />
      )}
      {notes.length > 0 && (
        <p id={`${id}-notes`} className="form-help">
          {notes.join(" ")}
        </p>
      )}

      <SaveStatus state={state} pending={pending} />

      <div className="form-actions">
        <button type="submit" className="form-button" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
