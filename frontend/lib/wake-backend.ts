import { api } from "./api";

// Render's free tier sleeps after 15 idle minutes and takes up to about a
// minute to wake. The contact form posts straight to the backend, so the
// data cache can't cover it: instead the form calls this when it loads,
// and the backend is usually awake by the time the visitor sends. Chosen
// over a keep-warm ping, which would use nearly all of the workspace's
// free Render hours (see docs/roadmap.md). Fire and forget: nothing reads
// the result, and a failure is swallowed, because an unhandled rejection
// would reach Sentry and the form already explains a backend that's down.
export function wakeBackend(): void {
  api.GET("/health").catch(() => {});
}
