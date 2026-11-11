"use server";

import { adminRequest } from "@/lib/admin-api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { formText } from "@/lib/form-data";
import { describeSaveFailure, SERVER_UNREACHABLE } from "@/lib/messages";
import { revalidatePublic } from "@/lib/revalidate-public";

// A save returns the value it stored, so the form can update its notes
// without re-fetching the page.
export type ContentFormState = { error: string } | { saved: string } | null;

export async function updateContent(
  key: string,
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const value = formText(formData, "value");
  // There's no way to delete a key, so an empty value would render as a
  // blank spot on the page instead of falling back to the built-in text.
  if (!value) return { error: "This can't be empty." };

  const result = await adminRequest((api) =>
    api.PUT("/content/{key}", { params: { path: { key } }, body: { value } }),
  );
  if (!result) return { error: SERVER_UNREACHABLE };
  const { response, error } = result;
  if (error) return { error: describeSaveFailure(response, error) };
  revalidatePublic(CACHE_TAGS.content);
  return { saved: value };
}
