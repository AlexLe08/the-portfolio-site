import * as Sentry from "@sentry/nextjs";
import { cache } from "react";
import { api } from "./api";
import { CACHE_TAGS, PUBLIC_LOAD_TIMEOUT_MS, publicCache } from "./cache-tags";

// What the site shows when the backend is cold, down, or missing a key.
// These mirror the production values. The backend's value always wins, so
// the text here only appears during an outage; after editing a key through
// PUT /content/{key}, update it here too so an outage doesn't show old copy.
//
// Keys ending in "intro" are rendered as markdown (links, paragraphs).
// The rest are short labels rendered as plain text.
export const FALLBACK_CONTENT = {
  "site.description": "Full-stack case studies and projects.",
  "home.role":
    "Software engineer building technology for e-commerce and healthcare. TypeScript and Python, with four years of production React at CVS Health.",
  "home.fact.role": "Software Engineer",
  "home.fact.location": "Worcester, MA",
  "home.fact.status": "Open to opportunities",
  "home.intro":
    "This site documents three recent projects end to end: the architecture decisions, the tests that caught real bugs, and the incidents that shaped the final design. The first is this site itself.",
  "contact.intro":
    "Questions about a project, or a role you think fits? Send a message and I'll reply by email.",
};

export type ContentKey = keyof typeof FALLBACK_CONTENT;
export type SiteContent = Record<ContentKey, string>;

export type ContentResult = {
  content: SiteContent;
  // True when the load failed and every key shows its built-in value. A key
  // that simply has no saved value isn't a fallback: there the built-in
  // value is the current one. Pages pass it to FallbackNotice.
  fallback: boolean;
};

// Thrown for an HTTP error from GET /content. Unlike a cold start (network
// failure or timeout), that's a real bug, so getContent() reports it.
class ContentHttpError extends Error {
  constructor(readonly body: unknown) {
    super("Failed to load site content");
  }
}

// The saved copy, straight from the backend. Throws on any failure, so
// publicCache() below only ever stores good data.
export async function fetchContent(): Promise<Record<string, string>> {
  const { data, error } = await api.GET("/content", {
    signal: AbortSignal.timeout(PUBLIC_LOAD_TIMEOUT_MS),
  });
  if (!data) throw new ContentHttpError(error);
  return data;
}

// Admin saves revalidate CACHE_TAGS.content. A miss's error reaches
// getContent().
const cachedContent = publicCache(fetchContent, "content", CACHE_TAGS.content);

// cache() memoizes per request on top: a page and its generateMetadata can
// both call getContent() and share one lookup.
export const getContent = cache(async (): Promise<ContentResult> => {
  try {
    const data = await cachedContent();
    return { content: { ...FALLBACK_CONTENT, ...pickKnownKeys(data) }, fallback: false };
  } catch (error) {
    if (error instanceof ContentHttpError) {
      Sentry.captureException(error, { extra: { error: error.body } });
    } else {
      // Network failure or timeout. Log it, but never fail the page over copy.
      console.error("Falling back to built-in site content:", error);
    }
  }
  return { content: FALLBACK_CONTENT, fallback: true };
});

function pickKnownKeys(remote: Record<string, string>): Partial<SiteContent> {
  return Object.fromEntries(
    Object.entries(remote).filter(([key]) => key in FALLBACK_CONTENT),
  );
}
