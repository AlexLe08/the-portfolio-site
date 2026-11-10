import type { components } from "./api-types";

// Shown when a backend call throws (network failure or timeout). Render's
// free tier takes up to about a minute to wake from sleep.
export const SERVER_UNREACHABLE =
  "Couldn't reach the server. It may be waking up, so try again in a minute.";

// Turns a 429's Retry-After (seconds, see backend core/rate_limit.py) into
// "in 12 minutes", so the text follows the configured window. The header
// could also be an HTTP date, which ours never sends; that, a missing
// header, or one CORS didn't expose all fall back to "later".
export function describeRetryAfter(header: string | null): string {
  const seconds = Number(header);
  if (!header || !Number.isFinite(seconds) || seconds <= 0) return "later";
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 1) return "in a minute";
  if (minutes < 60) return `in ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "in about an hour" : `in about ${hours} hours`;
}

// For a rejected admin save: 422 bodies list each failing field; anything
// else gets its status code.
export function describeSaveFailure(response: Response, error: unknown): string {
  const detail = (error as components["schemas"]["HTTPValidationError"] | undefined)?.detail;
  if (response.status === 422 && detail?.length) {
    return detail.map((item) => `${item.loc.at(-1)}: ${item.msg}`).join(" ");
  }
  return `Saving failed (HTTP ${response.status}).`;
}
