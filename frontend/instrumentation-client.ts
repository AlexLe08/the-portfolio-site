import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

// Runs in the browser before hydration. Reports uncaught errors and
// unhandled rejections; options and privacy rules are in lib/sentry.ts.
Sentry.init({
  ...sentryOptions,
  // When a Server Component fails, the browser gets a stand-in error with
  // only a digest ("Minified React error #441") and reports it too. The
  // server already sent the real one through onRequestError, so drop the
  // copy: it would count twice against the quota and tell us nothing.
  // Errors thrown in the browser have no digest.
  beforeSend(event, hint) {
    const error = hint.originalException;
    if (typeof error === "object" && error !== null && "digest" in error) {
      return null;
    }
    return event;
  },
});
