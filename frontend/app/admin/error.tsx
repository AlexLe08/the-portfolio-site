"use client"; // Error boundaries must be client components.

import { ErrorNotice } from "@/components/ErrorNotice";

// Catches failures while an admin page loads (backend down, unexpected
// status). retry() re-renders the segment, which fetches again.
export default function AdminError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorNotice
      message={<>Couldn&rsquo;t load from the server. It may be waking up, so try again in a minute.</>}
      retry={retry}
    />
  );
}
