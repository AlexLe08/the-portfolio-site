// Media upload rules shared by MediaUploadForm (browser checks) and the
// media Server Actions (the real check before calling the backend).
// They mirror backend services/media.py and schemas.MediaCreate, which have
// the final say.

// 4 MB: every upload passes through a Server Action, and Vercel rejects
// request bodies over 4.5 MB (bodySizeLimit in next.config.ts).
const MAX_UPLOAD_MB = 4;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// No SVG: it can carry scripts.
const FORMATS = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "image/avif": "AVIF",
};
export const ALLOWED_TYPES = Object.keys(FORMATS);

// "JPEG, PNG, WebP, GIF, or AVIF"
export const FORMAT_NAMES = new Intl.ListFormat("en", { type: "disjunction" }).format(
  Object.values(FORMATS),
);
export const UPLOAD_LIMIT_TEXT = `${FORMAT_NAMES}, up to ${MAX_UPLOAD_MB} MB.`;
export const TOO_LARGE = `Images can be at most ${MAX_UPLOAD_MB} MB.`;

// The backend's String(300) column.
export const ALT_TEXT_MAX_LENGTH = 300;

// Returns what's wrong with a picked file, or null when it can be sent.
export function checkImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return `Pick a ${FORMAT_NAMES} image.`;
  if (file.size > MAX_UPLOAD_BYTES) return TOO_LARGE;
  return null;
}

// Same shape as checkImageFile, for the trimmed alt text.
export function checkAltText(altText: string): string | null {
  if (!altText || altText.length > ALT_TEXT_MAX_LENGTH) {
    return `Alt text is required, up to ${ALT_TEXT_MAX_LENGTH} characters.`;
  }
  return null;
}
