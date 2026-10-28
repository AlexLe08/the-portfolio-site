"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// A deleted image's row disappears, taking its button (and keyboard focus)
// with it, so the confirmation lives here instead: above the list, and
// focused so keyboard and screen reader users land on it.
const SetNotice = createContext<(altText: string | null) => void>(() => {});

export function useDeleteNotice() {
  return useContext(SetNotice);
}

export function MediaDeleteNotice({ children }: { children: ReactNode }) {
  const [deleted, setDeleted] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (deleted !== null) ref.current?.focus();
  }, [deleted]);

  return (
    <SetNotice value={setDeleted}>
      {deleted !== null && (
        <div ref={ref} tabIndex={-1} className="form-status form-status--success" role="status">
          Deleted &ldquo;{deleted}&rdquo;.
        </div>
      )}
      {children}
    </SetNotice>
  );
}
