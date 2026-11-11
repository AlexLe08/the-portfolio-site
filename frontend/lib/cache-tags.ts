import { unstable_cache } from "next/cache";
import { apiBaseUrl } from "./api";

// Tags for the public pages' cached backend data (publicCache() below, in
// lib/content.ts, lib/character.ts, and lib/projects.ts). An admin save
// revalidates the tag for what it changed (revalidatePublic() in
// lib/revalidate-public.ts): the next visit still gets the old copy while
// it refreshes in the background, and the visits after that see the edit,
// instead of waiting out PUBLIC_REVALIDATE_SECONDS.
export const CACHE_TAGS = {
  content: "content",
  characterSheet: "character-sheet",
  projects: "projects",
} as const;

// How old cached data can get before a visit refreshes it in the
// background. Admin saves revalidate their tag, so this only matters for
// changes made around the admin UI (seed scripts, direct API calls). A
// refresh that fails keeps the old data.
export const PUBLIC_REVALIDATE_SECONDS = 3600;

// Part of every cached loader's key, so data cached by an older deploy
// never reaches newer page code that may expect another shape (Vercel's
// data cache outlives deploys). Costs one miss per page after each deploy.
// Vercel sets VERCEL_GIT_COMMIT_SHA at build and runtime when system
// environment variables are enabled; without it the key is constant, as
// it is locally.
export const CACHE_VERSION = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";

// How long a public page waits for the backend on a cache miss. Render's
// free tier takes 30-50s to wake; the content and the character sheet have
// built-in fallbacks and the project list has ProjectsUnavailable (with
// AutoRetry filling it in once Render is awake), so none is worth holding
// the page that long. It also keeps a background refresh against a
// sleeping backend from holding the function open while it wakes.
export const PUBLIC_LOAD_TIMEOUT_MS = 5000;

// A public loader shared between requests through Next's data cache, under
// one of CACHE_TAGS. A stale entry is served at once and refreshed in the
// background, and a refresh that fails keeps the old copy, so a sleeping
// backend doesn't hold the page. Only a miss waits for the backend, and its
// error reaches the caller, so fn must throw on any failure: then only good
// data is cached. apiBaseUrl is in the key because fn reads it from its
// closure; CACHE_VERSION keeps each deploy's entries apart. Arguments are
// part of each entry's key already.
export function publicCache<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  name: string,
  tag: (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS],
): (...args: Args) => Promise<Result> {
  return unstable_cache(fn, [name, apiBaseUrl, CACHE_VERSION], {
    tags: [tag],
    revalidate: PUBLIC_REVALIDATE_SECONDS,
  });
}
