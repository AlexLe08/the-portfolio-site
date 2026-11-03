"use server";

import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { describeRetryAfter, SERVER_UNREACHABLE } from "@/lib/messages";
import { createSession, deleteSession } from "@/lib/session";

// The password goes browser -> Vercel -> Render and is never stored or
// logged here. Anyone can POST to an action directly, so each one checks
// its own input rather than trusting the page that renders the form.

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
    return { error: SERVER_UNREACHABLE };
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
    case 429:
      return `Too many attempts. Try again ${describeRetryAfter(response.headers.get("Retry-After"))}.`;
    case 503:
      return "Login isn't set up on the server yet (ADMIN_PASSWORD_HASH).";
    default:
      return `Login failed (HTTP ${response.status}).`;
  }
}
