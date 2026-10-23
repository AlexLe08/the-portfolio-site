import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

// Server-side init, loaded by instrumentation.ts in the Node.js runtime.
// There's no sentry.edge.config.ts: nothing here runs on the edge runtime
// (no proxy.ts, no edge routes). Add one if that changes.
Sentry.init(sentryOptions);
