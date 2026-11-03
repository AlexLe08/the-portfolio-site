"use server";

import { revalidatePath } from "next/cache";
import { adminRequest } from "@/lib/admin-api";
import type { components } from "@/lib/api-types";
import { formText } from "@/lib/form-data";
import { checkAltText, checkImageFile, FORMAT_NAMES, TOO_LARGE } from "@/lib/media-rules";
import { describeSaveFailure, SERVER_UNREACHABLE } from "@/lib/messages";

// adminRequest() checks the session: Server Actions can be POSTed to
// directly, without the page that renders the form.

type Media = components["schemas"]["MediaRead"];
type UploadBody = components["schemas"]["Body_upload_media_media_post"];

export type MediaFormState = { error: string } | { saved: Media } | null;

// The backend's error codes for routes that call Cloudinary (routers/media.py).
const PROVIDER_FAILURES: Record<number, string> = {
  502: "The image host failed. Try again in a minute.",
  503: "Uploads aren't configured on the server (CLOUDINARY_URL is empty).",
};

// The backend's error codes for POST /media.
const UPLOAD_FAILURES: Record<number, string> = {
  413: TOO_LARGE,
  415: `That file isn't a ${FORMAT_NAMES} image.`,
  ...PROVIDER_FAILURES,
};

export async function uploadMedia(
  _previous: MediaFormState,
  formData: FormData,
): Promise<MediaFormState> {
  const file = formData.get("file");
  const altText = formText(formData, "alt_text");
  if (!(file instanceof File) || file.size === 0) return { error: "Pick an image to upload." };
  const problem = checkImageFile(file) ?? checkAltText(altText);
  if (problem) return { error: problem };

  const body = new FormData();
  body.append("file", file);
  body.append("alt_text", altText);

  // openapi-fetch sends a FormData body as is, letting fetch set the
  // multipart Content-Type and boundary. The generated type describes the
  // fields (file as a string), so the FormData needs a cast.
  const result = await adminRequest((api) =>
    api.POST("/media", { body: body as unknown as UploadBody }),
  );
  if (!result) return { error: SERVER_UNREACHABLE };
  const { data, response } = result;
  if (!data) {
    return { error: UPLOAD_FAILURES[response.status] ?? `Upload failed (HTTP ${response.status}).` };
  }

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
  const altText = formText(formData, "alt_text");
  const problem = checkAltText(altText);
  if (problem) return { error: problem };

  const result = await adminRequest((api) =>
    api.PATCH("/media/{media_id}", {
      params: { path: { media_id: id } },
      body: { alt_text: altText },
    }),
  );
  if (!result) return { error: SERVER_UNREACHABLE };
  const { data, error, response } = result;
  if (response.status === 404) return { error: "This image was deleted. Reload the page." };
  if (!data) return { error: describeSaveFailure(response, error) };

  // The image's alt and its markdown line are rendered from the saved text.
  revalidatePath("/admin/media");
  return { saved: data };
}

export type DeleteMediaState = { error: string } | { deleted: true } | null;

// Bound to one image's id by the media page. On success the page
// re-renders without the image.
export async function deleteMedia(id: number): Promise<DeleteMediaState> {
  const result = await adminRequest((api) =>
    api.DELETE("/media/{media_id}", { params: { path: { media_id: id } } }),
  );
  if (!result) return { error: SERVER_UNREACHABLE };
  const { error, response } = result;
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
