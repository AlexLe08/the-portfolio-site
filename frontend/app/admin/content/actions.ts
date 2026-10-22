"use server";

import { adminApi, redirectIfUnauthorized } from "@/lib/admin-api";

// adminApi() calls verifySession() first: Server Actions can be POSTed to
// directly, so this one checks the session itself.

// A save returns the value it stored, so the form can update its notes
// without re-fetching the page.
export type ContentFormState = { error: string } | { saved: string } | null;

export async function updateContent(
  key: string,
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const value = String(formData.get("value") ?? "").trim();
  // There's no way to delete a key, so an empty value would render as a
  // blank spot on the page instead of falling back to the built-in text.
  if (!value) return { error: "This can't be empty." };

  const api = await adminApi();
  let result;
  try {
    result = await api.PUT("/content/{key}", {
      params: { path: { key } },
      body: { value },
    });
  } catch {
    return { error: "Couldn't reach the server. It may be waking up, so try again in a minute." };
  }
  const { response, error } = result;
  redirectIfUnauthorized(response);
  if (error) return { error: `Saving failed (HTTP ${response.status}).` };
  return { saved: value };
}
