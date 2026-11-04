"use client"; // Error boundaries must be client components.

import { Sheet } from "@/components/Sheet";
import { StatusMessage } from "@/components/StatusMessage";

// Catches failures while a public page loads (backend down, unexpected
// status). It sits inside the root layout, so the site header stays.
// retry() re-renders the page, which fetches again. No Sentry call here:
// onRequestError in instrumentation.ts already reports server errors.
export default function PublicError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Sheet>
      <StatusMessage tone="error">
        Couldn&rsquo;t load this page. The server may be waking up, so try again in a minute.
      </StatusMessage>
      <button type="button" className="form-button" onClick={() => retry()}>
        Try again
      </button>
    </Sheet>
  );
}
