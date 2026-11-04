"use client"; // Error boundaries must be client components.

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Sheet } from "@/components/Sheet";
import { StatusMessage } from "@/components/StatusMessage";
import "./globals.css";

// Shown when the root layout itself fails, so it replaces the whole page
// and needs its own <html>, <body>, styles, and <title> (no metadata
// exports here). Other errors are caught closer to where they happen
// (app/error.tsx, app/admin/error.tsx). Server errors are
// already reported by onRequestError in instrumentation.ts; this reports
// errors thrown in the browser.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <title>Something went wrong</title>
        <Sheet>
          <StatusMessage tone="error">
            Something went wrong loading this page. It has been reported.
          </StatusMessage>
          <button type="button" className="form-button" onClick={() => retry()}>
            Try again
          </button>
        </Sheet>
      </body>
    </html>
  );
}
