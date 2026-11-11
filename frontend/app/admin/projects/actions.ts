"use server";

import { redirect } from "next/navigation";
import { adminRequest } from "@/lib/admin-api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { components } from "@/lib/api-types";
import { formText } from "@/lib/form-data";
import { describeSaveFailure, SERVER_UNREACHABLE } from "@/lib/messages";
import { isValidSlug, MAX_LENGTH } from "@/lib/project-rules";
import { revalidatePublic } from "@/lib/revalidate-public";

export type ProjectFormState = { error: string } | { saved: true } | null;

type ProjectFields = Omit<components["schemas"]["ProjectCreate"], "slug">;

export async function createProject(
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const slug = formText(formData, "slug");
  if (!isValidSlug(slug)) {
    return {
      error: `The slug can only use lowercase letters, numbers and single hyphens, up to ${MAX_LENGTH.slug} characters.`,
    };
  }
  const parsed = parseProjectForm(formData);
  if ("error" in parsed) return parsed;

  const result = await adminRequest((api) =>
    api.POST("/projects", { body: { slug, ...parsed.fields } }),
  );
  if (!result) return { error: SERVER_UNREACHABLE };
  const { response, error } = result;
  if (response.status === 409) return { error: `A project with the slug "${slug}" already exists.` };
  if (error) return { error: describeSaveFailure(response, error) };
  revalidatePublic(CACHE_TAGS.projects);
  redirect(`/admin/projects/${slug}`);
}

export async function updateProject(
  slug: string,
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const parsed = parseProjectForm(formData);
  if ("error" in parsed) return parsed;

  // The form always sends every field, so this PATCH replaces them all.
  const result = await adminRequest((api) =>
    api.PATCH("/projects/{slug}", { params: { path: { slug } }, body: parsed.fields }),
  );
  if (!result) return { error: SERVER_UNREACHABLE };
  const { response, error } = result;
  if (response.status === 404) return { error: "This project no longer exists." };
  if (error) return { error: describeSaveFailure(response, error) };
  revalidatePublic(CACHE_TAGS.projects);
  return { saved: true };
}

function parseProjectForm(formData: FormData): { fields: ProjectFields } | { error: string } {
  const text = (name: string) => formText(formData, name);
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
