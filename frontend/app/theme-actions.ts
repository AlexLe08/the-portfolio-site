"use server";

import { cookies } from "next/headers";
import { readTheme, THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "@/lib/theme";

// The theme toggle's form action (components/ThemeToggle.tsx). Setting a
// cookie in a Server Action makes Next re-render the page in the same
// round trip, root layout included, so <html data-theme> and both toggles
// change together. With JavaScript off the form posts and the page renders
// again. Public on purpose: it only sets this visitor's own preference.
export async function setTheme(formData: FormData) {
  const theme = readTheme(formData.get("theme"));
  // A value no button sends: leave the setting as it is.
  if (!theme) return;
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, {
    // Only the server reads it.
    httpOnly: true,
    // Plain http on localhost; Vercel (previews included) is always https.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
  });
}
