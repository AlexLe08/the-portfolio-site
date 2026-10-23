import * as Sentry from "@sentry/nextjs";

// Next calls register() once when a server instance starts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

// Reports errors thrown while rendering Server Components, in Route
// Handlers, and in Server Actions. The browser only ever gets a digest.
export const onRequestError = Sentry.captureRequestError;
