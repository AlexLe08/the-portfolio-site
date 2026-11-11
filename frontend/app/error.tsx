"use client"; // Error boundaries must be client components.

import { ErrorNotice } from "@/components/ErrorNotice";

// Catches failures while a public page loads (backend down, unexpected
// status). It sits inside the root layout, so the site header stays.
// retry() re-renders the page, which fetches again. No Sentry call here:
// onRequestError in instrumentation.ts already reports server errors.
export default function PublicError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorNotice
      message={<>Couldn&rsquo;t load this page. The server may be waking up, so try again in a minute.</>}
      retry={retry}
    />
  );
}
