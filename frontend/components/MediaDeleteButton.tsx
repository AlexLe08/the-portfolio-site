"use client";

import { useState, useTransition } from "react";
import type { DeleteMediaState } from "@/app/admin/media/actions";

type Props = {
  // deleteMedia bound to this image's id.
  action: () => Promise<DeleteMediaState>;
  altText: string;
};

// A button rather than a useSaveAction form: there are no fields, and on
// success the page re-renders without this image, so only errors show.
export function MediaDeleteButton({ action, altText }: Props) {
  const [state, setState] = useState<DeleteMediaState>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(`Delete "${altText}"? The file is removed from Cloudinary and can't be restored.`)) {
      return;
    }
    startTransition(async () => setState(await action()));
  }

  return (
    <div className="form-actions">
      {state && (
        <div className="form-status form-status--error" role="alert">
          {state.error}
        </div>
      )}
      <button type="button" className="form-button" disabled={pending} onClick={onClick}>
        {pending ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
