"use server";

import { redirect } from "next/navigation";
import { adminApi, redirectIfUnauthorized } from "@/lib/admin-api";
import type { components } from "@/lib/api-types";
import { SERVER_UNREACHABLE } from "@/lib/messages";
import { isValidSlug, MAX_LENGTH } from "@/lib/project-rules";

// adminApi() calls verifySession() first, so every action here checks the
// session itself: Server Actions can be POSTed to directly, without the
// page that renders the form.

export type ProjectFormState = { error: string } | { saved: true } | null;

type ProjectFields = Omit<components["schemas"]["ProjectCreate"], "slug">;

export async function createProject(
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const slug = String(formData.get("slug") ?? "").trim();
  if (!isValidSlug(slug)) {
    return {
      error: `The slug can only use lowercase letters, numbers and single hyphens, up to ${MAX_LENGTH.slug} characters.`,
    };
  }
  const parsed = parseProjectForm(formData);
  if ("error" in parsed) return parsed;

  const api = await adminApi();
  let result;
  try {
    result = await api.POST("/projects", { body: { slug, ...parsed.fields } });
  } catch {
    return { error: SERVER_UNREACHABLE };
  }
  const { response, error } = result;
  redirectIfUnauthorized(response);
  if (response.status === 409) return { error: `A project with the slug "${slug}" already exists.` };
  if (error) return { error: describeFailure(response, error) };

  // Outside any try block: redirect() works by throwing.
  redirect(`/admin/projects/${slug}`);
}

export async function updateProject(
  slug: string,
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const parsed = parseProjectForm(formData);
  if ("error" in parsed) return parsed;

  const api = await adminApi();
  let result;
  try {
    // The form always sends every field, so this PATCH replaces them all.
    result = await api.PATCH("/projects/{slug}", {
      params: { path: { slug } },
      body: parsed.fields,
    });
  } catch {
    return { error: SERVER_UNREACHABLE };
  }
  const { response, error } = result;
  redirectIfUnauthorized(response);
  if (response.status === 404) return { error: "This project no longer exists." };
  if (error) return { error: describeFailure(response, error) };
  return { saved: true };
}

function parseProjectForm(formData: FormData): { fields: ProjectFields } | { error: string } {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const title = text("title");
  const summary = text("summary");
  // Not trimmed: leading indentation can be meaningful in markdown.
  const caseStudy = String(formData.get("case_study_md") ?? "");
  const sortOrder = Number(text("sort_order"));

  if (!title || !summary || !caseStudy.trim()) {
    return { error: "Title, summary and case study are all required." };
  }
  if (!Number.isInteger(sortOrder)) {
    return { error: "Order must be a whole number." };
  }

  return {
    fields: {
      title,
      summary,
      case_study_md: caseStudy,
      stack: text("stack")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      // Empty clears it: the backend accepts null for repo_url only.
      repo_url: text("repo_url") || null,
      published: formData.get("published") === "on",
      sort_order: sortOrder,
    },
  };
}

// 422 bodies list each failing field; anything else gets its status code.
function describeFailure(response: Response, error: unknown): string {
  const detail = (error as components["schemas"]["HTTPValidationError"]).detail;
  if (response.status === 422 && detail?.length) {
    return detail.map((item) => `${item.loc.at(-1)}: ${item.msg}`).join(" ");
  }
  return `Saving failed (HTTP ${response.status}).`;
}
