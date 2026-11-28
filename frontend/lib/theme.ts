// The site's light/dark setting. One cookie, set by setTheme
// (app/theme-actions.ts) and read by the root layout into
// <html data-theme>. With no cookie the attribute is left off and
// globals.css follows the device's prefers-color-scheme, so a first visit
// needs no JavaScript and never flashes the wrong theme.

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "theme";

// A year: long enough to feel remembered, and the browser renews it on
// every toggle.
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// The cookie's value, or a form field's, as a theme. Anything else (a
// missing cookie, an old or hand-edited value) is no choice, so the page
// follows the device.
export function readTheme(value: unknown): Theme | undefined {
  return THEMES.find((theme) => theme === value);
}
