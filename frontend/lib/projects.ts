import * as Sentry from "@sentry/nextjs";
import { api } from "./api";
import type { components } from "./api-types";

export type ProjectSummary = components["schemas"]["ProjectSummary"];

// The home page's project list. null when the backend is down or returns
// an error, so the page can still render its copy (which has fallbacks)
// instead of the whole-page app/error.tsx. Catching here means
// onRequestError never sees the failure, so it's reported to Sentry by hand.
export async function loadProjects(): Promise<ProjectSummary[] | null> {
  try {
    const { data, error } = await api.GET("/projects");
    if (data) return data;
    Sentry.captureException(new Error("Failed to load projects"), { extra: { error } });
  } catch (error) {
    // openapi-fetch throws when the backend is unreachable.
    Sentry.captureException(error);
  }
  return null;
}
