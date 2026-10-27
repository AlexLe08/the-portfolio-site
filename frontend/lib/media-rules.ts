// Media upload rules shared by MediaUploadForm (browser checks) and the
// uploadMedia Server Action (the real check before calling the backend).
// They mirror backend services/media.py and schemas.MediaCreate, which have
// the final say.

// 4 MB: every upload passes through a Server Action, and Vercel rejects
// request bodies over 4.5 MB (bodySizeLimit in next.config.ts).
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// No SVG: it can carry scripts.
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

// The backend's String(300) column.
export const ALT_TEXT_MAX_LENGTH = 300;

// Returns what's wrong with a picked file, or null when it can be sent.
export function checkImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Pick a JPEG, PNG, WebP, GIF, or AVIF image.";
  if (file.size > MAX_UPLOAD_BYTES) return "Images can be at most 4 MB.";
  return null;
}
