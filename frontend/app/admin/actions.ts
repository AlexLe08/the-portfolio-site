"use server";

import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { createSession, deleteSession } from "@/lib/session";

// Server Actions: these run only on the server, though LoginForm calls
// them like local functions. The password goes browser -> Vercel ->
// Render and is never stored or logged here. Anyone can POST to an action
// directly, so each one must check its own input (and, for admin actions,
// call verifySession()) rather than trust the page that renders the form.

export type LoginState = { error: string } | null;

// Render's free tier takes 30-50s to wake. Hobby functions can run for
// 300s, so wait long enough for a cold start, but not indefinitely.
const LOGIN_TIMEOUT_MS = 60_000;

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password === "") {
    return { error: "Enter the password." };
  }

  let result;
  try {
    result = await api.POST("/auth/login", {
      body: { password },
      signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
    });
  } catch {
    return { error: "Couldn't reach the server. It may be waking up, so try again in a minute." };
  }

  const { data, response } = result;
  if (!data) return { error: describeLoginFailure(response) };

  await createSession(data.access_token, new Date(data.expires_at));
  // Outside any try block: redirect() works by throwing.
  redirect("/admin");
}

export async function logout() {
  await deleteSession();
  redirect("/admin/login");
}

// The statuses come from backend routers/auth.py. Only 422 is in the
// OpenAPI error shapes, so the rest are matched by status code.
function describeLoginFailure(response: Response): string {
  switch (response.status) {
    case 401:
      return "Wrong password.";
    case 429: {
      const seconds = Number(response.headers.get("Retry-After"));
      const minutes = Math.max(1, Math.ceil(seconds / 60));
      return Number.isFinite(seconds) && seconds > 0
        ? `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
        : "Too many attempts. Try again later.";
    }
    case 503:
      return "Login isn't set up on the server yet (ADMIN_PASSWORD_HASH).";
    default:
      return `Login failed (HTTP ${response.status}).`;
  }
}
