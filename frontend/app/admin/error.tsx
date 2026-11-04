"use client"; // Error boundaries must be client components.

import { Sheet } from "@/components/Sheet";
import { StatusMessage } from "@/components/StatusMessage";

// Catches failures while an admin page loads (backend down, unexpected
// status). retry() re-renders the segment, which fetches again.
export default function AdminError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Sheet>
      <StatusMessage tone="error">
        Couldn&rsquo;t load from the server. It may be waking up, so try again in a minute.
      </StatusMessage>
      <button type="button" className="form-button" onClick={() => retry()}>
        Try again
      </button>
    </Sheet>
  );
}
