"use client";

import { useRetriesGaveUp } from "./AutoRetry";
import { StatusMessage } from "./StatusMessage";

// Tells visitors the page shows built-in values because loading the saved
// ones failed, so it's clear whether what they see is current. Pages render
// it from the `fallback` flags of getContent() and getCharacterConfig():
// `<Sheet notice={fallback && <FallbackNotice />}>`, inside an AutoRetry
// that retries the page. Those flags stay false when nothing is saved:
// there the built-in values are current, and a notice that never goes away
// gets ignored. Tone info, not error: for a visitor this is a delay.
export function FallbackNotice() {
  const gaveUp = useRetriesGaveUp();
  return (
    <StatusMessage tone="info">
      Parts of this page show built-in content because the latest couldn&rsquo;t be loaded.{" "}
      {gaveUp
        ? "Reload in a few minutes for the latest."
        : "Trying again in the background; the page will update on its own."}
    </StatusMessage>
  );
}
