"use client";

import { useEffect, useState, type ReactNode } from "react";

// The panel's only client code. Showing the tooltip is pure CSS (hover, or
// keyboard focus inside the slot), so it works before hydration and without
// JavaScript. This adds what CSS can't: Escape hides the tooltip without
// moving focus or the pointer (WCAG 1.4.13), until the pointer leaves or
// focus moves on.
export function SlotHover({ children }: { children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // A hovered slot usually doesn't have focus, so its own onKeyDown never
  // sees the key: listen on the document while the pointer is over it.
  useEffect(() => {
    if (!hovered) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hovered]);

  return (
    <div
      className="cs-slot__hover"
      data-dismissed={dismissed || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") setDismissed(true);
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setDismissed(false);
      }}
      onBlur={() => setDismissed(false)}
    >
      {children}
    </div>
  );
}
