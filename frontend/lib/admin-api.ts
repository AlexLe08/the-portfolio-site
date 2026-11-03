import "server-only";
import createClient from "openapi-fetch";
import { notFound, redirect } from "next/navigation";
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

type AdminClient = Awaited<ReturnType<typeof adminApi>>;

// For admin Server Actions. Returns null when the call throws (network
// failure or timeout), so the action can show SERVER_UNREACHABLE. The
// redirects stay outside the try: redirect() works by throwing.
export async function adminRequest<Result extends { response: Response }>(
  call: (api: AdminClient) => Promise<Result>,
): Promise<Result | null> {
  const api = await adminApi();
  let result;
  try {
    result = await call(api);
  } catch {
    return null;
  }
  redirectIfUnauthorized(result.response);
  return result;
}

// For admin pages: returns the data or throws, which app/admin/error.tsx
// shows (a network failure throws on its own). With notFoundOn404, a 404
// shows the not-found page instead.
export async function adminLoad<Data>(
  what: string,
  call: (api: AdminClient) => Promise<{ data?: Data; response: Response }>,
  { notFoundOn404 = false } = {},
): Promise<Data> {
  const { data, response } = await call(await adminApi());
  redirectIfUnauthorized(response);
  if (notFoundOn404 && response.status === 404) notFound();
  if (data === undefined) throw new Error(`Loading ${what} failed (HTTP ${response.status})`);
  return data;
}

// A 401 while the cookie exists means the backend no longer accepts the
// token (JWT_SECRET was changed, or the cookie was tampered with). Cookies
// can't be deleted while a page renders, so this sends you to the login
// page with ?expired, which skips its "already signed in" redirect; the
// next login overwrites the stale cookie.
function redirectIfUnauthorized(response: Response) {
  if (response.status === 401) redirect("/admin/login?expired=1");
}
