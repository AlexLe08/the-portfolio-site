"use server";

import { revalidatePath } from "next/cache";
import { adminApi, redirectIfUnauthorized } from "@/lib/admin-api";
import type { components } from "@/lib/api-types";
import { ALT_TEXT_MAX_LENGTH, checkImageFile } from "@/lib/media-rules";
import { SERVER_UNREACHABLE } from "@/lib/messages";

// adminApi() calls verifySession() first: Server Actions can be POSTed to
// directly, so this one checks the session itself.

type Media = components["schemas"]["MediaRead"];
type UploadBody = components["schemas"]["Body_upload_media_media_post"];

export type MediaFormState = { error: string } | { saved: Media } | null;

// The backend's error codes for routes that call Cloudinary (routers/media.py).
const PROVIDER_FAILURES: Record<number, string> = {
  502: "The image host failed. Try again in a minute.",
  503: "Uploads aren't configured on the server (CLOUDINARY_URL is empty).",
};

// The backend's error codes for POST /media.
const FAILURES: Record<number, string> = {
  413: "Images can be at most 4 MB.",
  415: "That file isn't a JPEG, PNG, WebP, GIF, or AVIF image.",
  ...PROVIDER_FAILURES,
};

export async function uploadMedia(
  _previous: MediaFormState,
  formData: FormData,
): Promise<MediaFormState> {
  const file = formData.get("file");
  const altText = String(formData.get("alt_text") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) return { error: "Pick an image to upload." };
  const fileProblem = checkImageFile(file);
  if (fileProblem) return { error: fileProblem };
  if (!altText || altText.length > ALT_TEXT_MAX_LENGTH) {
    return { error: `Alt text is required, up to ${ALT_TEXT_MAX_LENGTH} characters.` };
  }

  const body = new FormData();
  body.append("file", file);
  body.append("alt_text", altText);

  const api = await adminApi();
  let result;
  try {
    // openapi-fetch sends a FormData body as is, letting fetch set the
    // multipart Content-Type and boundary. The generated type describes the
    // fields (file as a string), so the FormData needs a cast.
    result = await api.POST("/media", { body: body as unknown as UploadBody });
  } catch {
    return { error: SERVER_UNREACHABLE };
  }
  const { data, response } = result;
  redirectIfUnauthorized(response);
  if (!data) return { error: FAILURES[response.status] ?? `Upload failed (HTTP ${response.status}).` };

  // Re-renders the media page so the list includes the new upload.
  revalidatePath("/admin/media");
  return { saved: data };
}

// Bound to one image's id by the media page.
export async function updateAltText(
  id: number,
  _previous: MediaFormState,
  formData: FormData,
): Promise<MediaFormState> {
  const altText = String(formData.get("alt_text") ?? "").trim();
  if (!altText || altText.length > ALT_TEXT_MAX_LENGTH) {
    return { error: `Alt text is required, up to ${ALT_TEXT_MAX_LENGTH} characters.` };
  }

  const api = await adminApi();
  let result;
  try {
    result = await api.PATCH("/media/{media_id}", {
      params: { path: { media_id: id } },
      body: { alt_text: altText },
    });
  } catch {
    return { error: SERVER_UNREACHABLE };
  }
  const { data, response } = result;
  redirectIfUnauthorized(response);
  if (response.status === 404) return { error: "This image was deleted. Reload the page." };
  if (!data) return { error: `Saving failed (HTTP ${response.status}).` };

  // The image's alt and its markdown line are rendered from the saved text.
  revalidatePath("/admin/media");
  return { saved: data };
}

export type DeleteMediaState = { error: string } | { deleted: true } | null;

// Bound to one image's id by the media page. On success the page
// re-renders without the image.
export async function deleteMedia(id: number): Promise<DeleteMediaState> {
  const api = await adminApi();
  let result;
  try {
    result = await api.DELETE("/media/{media_id}", { params: { path: { media_id: id } } });
  } catch {
    return { error: SERVER_UNREACHABLE };
  }
  const { error, response } = result;
  redirectIfUnauthorized(response);
  // 404: already deleted (another tab, or a retry), which is what was asked for.
  if (response.ok || response.status === 404) {
    revalidatePath("/admin/media");
    return { deleted: true };
  }
  // 409 names where the image is still used, written for people.
  if (response.status === 409 && error && "detail" in error && typeof error.detail === "string") {
    return { error: `${error.detail}.` };
  }
  return { error: PROVIDER_FAILURES[response.status] ?? `Deleting failed (HTTP ${response.status}).` };
}
