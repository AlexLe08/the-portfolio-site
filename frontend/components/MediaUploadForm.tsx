"use client";

import { useEffect, useRef, type ChangeEvent } from "react";
import { uploadMedia } from "@/app/admin/media/actions";
import { SaveStatus } from "@/components/SaveStatus";
import { ALLOWED_TYPES, ALT_TEXT_MAX_LENGTH, checkImageFile } from "@/lib/media-rules";
import { useSaveAction } from "@/lib/use-save-action";

export function MediaUploadForm() {
  const { state, pending, onSubmit } = useSaveAction(uploadMedia);
  const formRef = useRef<HTMLFormElement>(null);

  // Unlike the editors, a successful upload clears the form, so the same
  // file isn't uploaded twice by accident. A failed one keeps both fields.
  useEffect(() => {
    if (state && "saved" in state) formRef.current?.reset();
  }, [state]);

  // Checked as soon as a file is picked: the browser then refuses to submit
  // and says why. A file over Next's body size limit would otherwise fail
  // before the Server Action runs, showing the error page instead.
  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.setCustomValidity(file ? (checkImageFile(file) ?? "") : "");
    input.reportValidity();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      <div className="form-field">
        <label htmlFor="file" className="form-label">
          Image
        </label>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept={ALLOWED_TYPES.join(",")}
          onChange={onFileChange}
          aria-describedby="file-help"
          className="form-input"
        />
        <p id="file-help" className="form-help">
          JPEG, PNG, WebP, GIF, or AVIF, up to 4 MB.
        </p>
      </div>

      <div className="form-field">
        <label htmlFor="alt_text" className="form-label">
          Alt text
        </label>
        <input
          id="alt_text"
          name="alt_text"
          required
          maxLength={ALT_TEXT_MAX_LENGTH}
          aria-describedby="alt-help"
          className="form-input"
        />
        <p id="alt-help" className="form-help">
          What the image shows, for people who can&rsquo;t see it. It also becomes the file&rsquo;s
          name on Cloudinary.
        </p>
      </div>

      <SaveStatus state={state} pending={pending} />

      <div className="form-actions">
        <button type="submit" className="form-button" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
