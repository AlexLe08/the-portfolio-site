import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  images: {
    // Cloudinary resizes media library images, not Vercel (see the file).
    loader: "custom",
    loaderFile: "./lib/cloudinary-loader.ts",
  },
  experimental: {
    serverActions: {
      // Default 1 MB. Uploads go through a Server Action and are capped at
      // 4 MB (lib/media-rules.ts), plus multipart overhead. Vercel's own
      // limit on a request body is 4.5 MB, so this can't usefully go higher.
      bodySizeLimit: "4.5mb",
    },
  },
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
