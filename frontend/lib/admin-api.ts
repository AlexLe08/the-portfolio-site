import "server-only";
import createClient from "openapi-fetch";
import { redirect } from "next/navigation";
import { apiBaseUrl } from "./api";
import type { paths } from "./api-types";
import { verifySession } from "./session";

// Every admin backend call goes through this client. verifySession() runs
// first, so a signed-out request redirects to login before anything is
// sent, and the session token rides along as a Bearer header. The token
// stays on the server: nothing here ever reaches the browser.
export async function adminApi() {
  const token = await verifySession();
  return createClient<paths>({
    baseUrl: apiBaseUrl,
    headers: { Authorization: `Bearer ${token}` },
  });
}

// A 401 while the cookie exists means the backend no longer accepts the
// token (JWT_SECRET was changed, or the cookie was tampered with). Cookies
// can't be deleted while a page renders, so this sends you to the login
// page with ?expired, which skips its "already signed in" redirect; the
// next login overwrites the stale cookie.
export function redirectIfUnauthorized(response: Response) {
  if (response.status === 401) redirect("/admin/login?expired=1");
}
