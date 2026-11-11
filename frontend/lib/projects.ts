import * as Sentry from "@sentry/nextjs";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { api, apiBaseUrl } from "./api";
import type { components } from "./api-types";
import { CACHE_TAGS, CACHE_VERSION, PUBLIC_REVALIDATE_SECONDS } from "./cache-tags";

export type ProjectSummary = components["schemas"]["ProjectSummary"];
export type ProjectDetail = components["schemas"]["ProjectDetail"];

// Thrown for an HTTP error from the backend. The response body goes to
// Sentry as extra data.
class ProjectsHttpError extends Error {
  constructor(
    message: string,
    readonly body: unknown,
  ) {
    super(message);
  }
}

// Same limit as CONTENT_TIMEOUT_MS in lib/content.ts. A cold miss then shows
// the page within seconds, with ProjectsUnavailable where the list goes and
// AutoRetry filling it in once Render is awake, and a background refresh
// against a sleeping backend doesn't hold the function open while it wakes.
// Project pages have no timeout: without the case study there is nothing to
// show, so waiting for the backend beats app/error.tsx.
const PROJECTS_TIMEOUT_MS = 5000;

// The published project list, straight from the backend. Throws on any
// failure (openapi-fetch throws when the backend is unreachable or the
// timeout aborts the request), so unstable_cache below only ever stores
// good data.
export async function fetchProjects(): Promise<ProjectSummary[]> {
  const { data, error } = await api.GET("/projects", {
    signal: AbortSignal.timeout(PROJECTS_TIMEOUT_MS),
  });
  if (!data) throw new ProjectsHttpError("Failed to load projects", error);
  return data;
}

// Shared between requests through Next's data cache, like cachedContent in
// lib/content.ts (tag CACHE_TAGS.projects, which project saves
// revalidate). apiBaseUrl is in the key because the fetch reads it from its
// closure.
const cachedProjects = unstable_cache(fetchProjects, ["projects", apiBaseUrl, CACHE_VERSION], {
  tags: [CACHE_TAGS.projects],
  revalidate: PUBLIC_REVALIDATE_SECONDS,
});

// null when the load failed, so the page can still render its copy (which
// has fallbacks) instead of the whole-page app/error.tsx. Catching here
// means onRequestError never sees the failure, so it's reported to Sentry
// by hand. A timeout is only logged: a sleeping Render accepts the
// connection and holds it, so every cold start would otherwise be an event.
// An unreachable backend (connection refused) is still reported.
async function orNull(load: () => Promise<ProjectSummary[]>): Promise<ProjectSummary[] | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error("Project list timed out:", error);
      return null;
    }
    Sentry.captureException(
      error,
      error instanceof ProjectsHttpError ? { extra: { error: error.body } } : undefined,
    );
    return null;
  }
}

// The home page's project list, from the cache.
export function loadProjects(): Promise<ProjectSummary[] | null> {
  return orNull(cachedProjects);
}

// The same list read straight from the backend, for admin pages, which
// must show what's saved rather than what's cached.
export function loadProjectsLive(): Promise<ProjectSummary[] | null> {
  return orNull(fetchProjects);
}

// One published project with its case study. null on a 404 (unknown or
// unpublished slug), which is a real answer and gets cached like one, so
// unpublishing a project turns its page into a 404 once the cache
// refreshes. Throws on any other failure.
export async function fetchProject(slug: string): Promise<ProjectDetail | null> {
  const { data, error, response } = await api.GET("/projects/{slug}", {
    params: { path: { slug } },
  });
  if (data) return data;
  if (response.status === 404) return null;
  throw new ProjectsHttpError("Failed to load project", error);
}

// The slug is an argument, so it's part of each entry's key already.
const cachedProject = unstable_cache(fetchProject, ["project", apiBaseUrl, CACHE_VERSION], {
  tags: [CACHE_TAGS.projects],
  revalidate: PUBLIC_REVALIDATE_SECONDS,
});

// cache() memoizes per request on top, so a page and its generateMetadata
// share one lookup. Errors propagate: the page shows app/error.tsx, and
// onRequestError reports them.
export const getProject = cache((slug: string) => cachedProject(slug));
