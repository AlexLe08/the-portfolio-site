import { cookies } from "next/headers";
import { setTheme } from "@/app/theme-actions";
import { readTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

type Props = {
  // "header": a text button in the site header. "panel": a square
  // icon button for the character window's gearSetEnd, in the package's
  // cs__gear-button look.
  variant: "header" | "panel";
};

// The site's light/dark switch, in the site header and the character
// window: one "Dark theme" toggle button (aria-pressed) in a form, no
// client JavaScript. Both toggles follow the same cookie and
// <html data-theme>, so flipping either updates the other.
//
// With a saved choice it draws the one button for that theme. Pressing it
// re-renders the page with the button in the same place, so React keeps
// the element: focus stays on it and aria-pressed changes in place.
//
// With no saved choice the server can't know the device's setting, so it
// draws the button in both states and globals.css hides the one that
// doesn't match prefers-color-scheme (data-theme-when). The light state
// comes first, in the same place as the single button, so a first press
// on a light device keeps focus too; on a dark device it's lost that
// once, since the button that had it goes away.
export async function ThemeToggle({ variant }: Props) {
  const saved = readTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <form action={setTheme} className={`theme-toggle theme-toggle--${variant}`}>
      <ToggleButton variant={variant} showsIn={saved ?? "light"} />
      {!saved && <ToggleButton variant={variant} showsIn="dark" />}
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
