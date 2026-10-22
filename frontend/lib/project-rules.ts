// Project field rules shared by ProjectForm (browser hints) and the
// project Server Actions (the real check before calling the backend). They
// mirror backend schemas.ProjectCreate, which has the final say.

// Lowercase words joined by single hyphens, e.g. "portfolio-site". No ^ or
// $: the HTML pattern attribute adds them itself.
export const SLUG_PATTERN = "[a-z0-9]+(-[a-z0-9]+)*";

// The backend's String(n) column sizes.
export const MAX_LENGTH = {
  slug: 120,
  title: 200,
  repo_url: 300,
} as const;

const SLUG_REGEX = new RegExp(`^${SLUG_PATTERN}$`);

export function isValidSlug(slug: string): boolean {
  return slug.length <= MAX_LENGTH.slug && SLUG_REGEX.test(slug);
}
