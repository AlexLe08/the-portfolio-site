"use client";

import { useRetriesGaveUp } from "./AutoRetry";
import { StatusMessage } from "./StatusMessage";

// In place of the home page's project list when it couldn't be loaded.
// There's no built-in copy to show, so it says so where the list would be.
// While AutoRetry is still trying it's a plain line; only once the retries
// are used up does it become an error with a button to reload.
export function ProjectsUnavailable() {
  if (!useRetriesGaveUp()) {
    return (
      <StatusMessage tone="info">
        Couldn&rsquo;t load projects yet. Trying again in the background.
      </StatusMessage>
    );
  }
  return (
    <>
      <StatusMessage tone="error">
        Couldn&rsquo;t load projects. The server may be down, so try again in a few minutes.
      </StatusMessage>
      {/* A full reload, not next/link: <Link> to the current URL may
          be served from the client router cache, while a reload
          always fetches again. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="form-button">
        Try again
      </a>
    </>
  );
}
