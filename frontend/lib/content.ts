import { cache } from "react";
import { api } from "./api";

// What the site shows when the backend is cold, down, or missing a key.
// These mirror the production values. The backend's value always wins, so
// the text here only appears during an outage; after editing a key through
// PUT /content/{key}, update it here too so an outage doesn't show old copy.
//
// Keys ending in "intro" are rendered as markdown (links, paragraphs).
// The rest are short labels rendered as plain text.
const FALLBACK_CONTENT = {
  "site.description": "Full-stack case studies and projects.",
  "home.role":
    "Software engineer building technology for e-commerce and healthcare. TypeScript and Python, with four years of production React at CVS Health.",
  "home.fact.role": "Software Engineer",
  "home.fact.location": "Worcester, MA",
  "home.fact.status": "Open to opportunities",
  "home.intro":
    "This site documents three recent projects end to end: the architecture decisions, the tests that caught real bugs, and the incidents that shaped the final design. The first is this site itself.",
  "contact.intro":
    "Questions about a case study, or a role you think fits? Send a message and I'll reply by email.",
};

export type ContentKey = keyof typeof FALLBACK_CONTENT;
export type SiteContent = Record<ContentKey, string>;

// Render's free tier takes 30-50s to wake. Copy isn't worth holding a page
// that long, so give up after a few seconds and show the fallbacks.
const CONTENT_TIMEOUT_MS = 5000;

// cache() memoizes per request: a page and its generateMetadata can both
// call getContent() and share one backend request. Nothing is shared
// between requests, so every visit still sees the latest copy.
export const getContent = cache(async (): Promise<SiteContent> => {
  try {
    const { data } = await api.GET("/content", {
      signal: AbortSignal.timeout(CONTENT_TIMEOUT_MS),
    });
    return { ...FALLBACK_CONTENT, ...pickKnownKeys(data ?? {}) };
  } catch (error) {
    // Network failure or timeout. Log it, but never fail the page over copy.
    console.error("Falling back to built-in site content:", error);
    return FALLBACK_CONTENT;
  }
});

function pickKnownKeys(remote: Record<string, string>): Partial<SiteContent> {
  return Object.fromEntries(
    Object.entries(remote).filter(([key]) => key in FALLBACK_CONTENT),
  );
}
