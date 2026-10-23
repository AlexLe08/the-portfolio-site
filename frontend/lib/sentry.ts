import type { BrowserOptions } from "@sentry/nextjs";

// Options shared by the browser (instrumentation-client.ts) and the server
// (sentry.server.config.ts). Reporting is off until NEXT_PUBLIC_SENTRY_DSN
// is set; the SDK does nothing without a DSN. A DSN only lets you send
// events, so it isn't a secret, and the browser needs it anyway.
//
// Errors only: no tracesSampleRate (tracing), no replayIntegration (it
// would record visitors typing into the contact form), no feedback widget.
// Environment and release come from Vercel's variables, which the SDK
// reads by itself.
//
// dataCollection mirrors backend/app/core/monitoring.py. SDK v11 collects
// all of these by default:
// - httpBodies: Server Action bodies hold the contact message and the
//   admin login password.
// - cookies, httpHeaders: admin_session holds the admin JWT, and the
//   Cookie header carries it. Only User-Agent is kept, for browser info.
// - userInfo: visitor IP addresses.
// - stackFrameVariables: local values on the server, where a frame can
//   hold the session token or the password.
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: {
    httpBodies: [],
    cookies: false,
    httpHeaders: { request: { allow: ["user-agent"] }, response: false },
    userInfo: false,
    stackFrameVariables: false,
  },
} satisfies BrowserOptions;
