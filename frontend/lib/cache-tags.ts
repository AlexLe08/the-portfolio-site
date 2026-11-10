// Tags for the public pages' cached backend data (unstable_cache in
// lib/content.ts, lib/character.ts, and lib/projects.ts). An admin save
// revalidates the tag for what it changed, so visitors see the edit on
// their next visit instead of after PUBLIC_REVALIDATE_SECONDS.
export const CACHE_TAGS = {
  content: "content",
  characterSheet: "character-sheet",
  projects: "projects",
} as const;

// How old cached data can get before a visit refreshes it in the
// background. Admin saves revalidate their tag right away, so this only
// matters for changes made around the admin UI (seed scripts, direct API
// calls). A refresh that fails keeps the old data.
export const PUBLIC_REVALIDATE_SECONDS = 3600;
