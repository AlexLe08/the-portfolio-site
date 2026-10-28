"use client";

import { useState, useTransition } from "react";
import type { DeleteMediaState } from "@/app/admin/media/actions";
import { useDeleteNotice } from "@/components/MediaDeleteNotice";

type Props = {
  // deleteMedia bound to this image's id.
  action: () => Promise<DeleteMediaState>;
  altText: string;
};

// A button rather than a useSaveAction form: there are no fields, and on
// success the page re-renders without this image, so only errors show
// here. MediaDeleteNotice confirms a delete.
export function MediaDeleteButton({ action, altText }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const setNotice = useDeleteNotice();

  function onClick() {
    if (!window.confirm(`Delete "${altText}"? The file is removed from Cloudinary and can't be restored.`)) {
      return;
    }
    // Old messages would read as this delete's result.
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setNotice(altText);
      }
    });
  }

  return (
    <div className="form-actions">
      {error && (
        <div className="form-status form-status--error" role="alert">
          {error}
        </div>
      )}
      <button type="button" className="form-button" disabled={pending} onClick={onClick}>
        {pending ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
