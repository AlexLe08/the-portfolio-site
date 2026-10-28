"use client";

import { useEffect, useState } from "react";

type Props = {
  text: string;
  // The id of the input holding the same text, selected if copying fails
  // so the browser's own copy shortcut still works.
  inputId: string;
  label: string;
};

// navigator.clipboard needs a secure context (HTTPS or localhost) and can
// be refused by the browser, hence the fallback.
export function CopyButton({ text, inputId, label }: Props) {
  const [status, setStatus] = useState<"copied" | "failed" | null>(null);

  useEffect(() => {
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      const input = document.getElementById(inputId);
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
      setStatus("failed");
    }
  }

  return (
    <>
      <button type="button" className="form-button form-button--small" onClick={onClick}>
        {label}
      </button>
      <span role="status" className="copy-status">
        {status === "copied" && "Copied."}
        {status === "failed" && "Press Ctrl+C or ⌘C to copy."}
      </span>
    </>
  );
}
