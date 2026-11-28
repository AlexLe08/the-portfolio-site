import { setTheme } from "@/app/theme-actions";
import type { Theme } from "@/lib/theme";

type Props = {
  // "header": a text button in the site header. "panel": a square
  // icon button for the character window's gearSetEnd, in the package's
  // cs__gear-button look.
  variant: "header" | "panel";
};

// The site's light/dark switch, in the site header and the character
// window. A Server Component: one form, two buttons, no client JavaScript.
//
// The server doesn't know the device's setting, so it can't tell which
// state to draw when there's no cookie. Instead both buttons are drawn
// and globals.css hides the one that doesn't match the theme showing now
// (data-theme-when), whether that came from the cookie or from
// prefers-color-scheme. Each is the same "Dark theme" toggle button
// (aria-pressed) in one of its two states, and pressing it saves the
// other theme. Both toggles read the same <html data-theme>, so flipping
// either updates the other.
export function ThemeToggle({ variant }: Props) {
  return (
    <form action={setTheme} className={`theme-toggle theme-toggle--${variant}`}>
      <ToggleButton variant={variant} showsIn="light" />
      <ToggleButton variant={variant} showsIn="dark" />
    </form>
  );
}

function ToggleButton({ variant, showsIn }: Props & { showsIn: Theme }) {
  const dark = showsIn === "dark";
  return (
    <button
      type="submit"
      name="theme"
      value={dark ? "light" : "dark"}
      aria-pressed={dark}
      data-theme-when={showsIn}
      className={variant === "panel" ? "cs__gear-button theme-toggle__button" : "theme-toggle__button"}
    >
      {variant === "panel" ? (
        <>
          <MoonIcon />
          <span className="cs-visually-hidden">Dark theme</span>
        </>
      ) : (
        "Dark theme"
      )}
    </button>
  );
}

// Sized by the package's .cs__gear-button .cs-icon rule.
function MoonIcon() {
  return (
    <svg className="cs-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}
