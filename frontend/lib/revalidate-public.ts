import "server-only";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

// Called by admin Server Actions after a save succeeds, for the public data
// it changed. The "max" profile marks the tagged entries stale rather than
// expiring them (Next 16 revalidateTag docs, "Revalidation Behavior"): the
// next visitor gets the stale copy at once while a background refresh
// fetches the saved one, and the visit after that sees the edit. Expiring
// instead (updateTag, or { expire: 0 }) would make that next visitor wait
// on the backend, which may be asleep on Render's free tier, and fall back
// to built-in data if it doesn't wake within the timeout.
export function revalidatePublic(...tags: CacheTag[]): void {
  for (const tag of tags) revalidateTag(tag, "max");
}
