import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

// The wrapper adds Sentry's build step. Source maps are only uploaded when
// SENTRY_AUTH_TOKEN is set; without it the build still works, and browser
// stack traces stay minified.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Only print upload logs in CI.
  silent: !process.env.CI,
});
