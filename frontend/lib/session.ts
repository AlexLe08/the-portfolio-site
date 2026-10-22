import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

// The admin session is the backend's own JWT (from POST /auth/login), kept
// in an httpOnly cookie so browser JavaScript can never read it. This file
// never checks the token's signature, which would mean copying JWT_SECRET
// to Vercel. Having the cookie only decides what to render: the backend
// checks the token on every admin request, so a forged cookie gets an
// empty admin page whose every action fails with 401.
//
// "server-only" makes the build fail if a client component imports this.

const COOKIE_NAME = "admin_session";
// Sent only with requests under /admin. Admin Server Actions post to the
// page they're on, so they get it too, but no public page ever does.
const COOKIE_PATH = "/admin";

export async function createSession(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Plain http on localhost; Vercel (previews included) is always https.
    secure: process.env.NODE_ENV === "production",
    // Never sent when a request starts on another site. The cost: following
    // a link to /admin from elsewhere lands on the login page.
    sameSite: "strict",
    path: COOKIE_PATH,
    // Same expiry as the token, so the browser drops them together.
    expires: expiresAt,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: COOKIE_NAME, path: COOKIE_PATH });
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

// Call at the top of every admin page and every admin Server Action. A
// check in a layout isn't enough: layouts don't re-render on every
// navigation, and Server Actions can be called directly without the page.
// Returns the token for the Authorization header on backend calls.
export const verifySession = cache(async (): Promise<string> => {
  const token = await getSessionToken();
  if (!token) redirect("/admin/login");
  return token;
});
