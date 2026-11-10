// Tags for the public pages' cached backend data (unstable_cache in
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
