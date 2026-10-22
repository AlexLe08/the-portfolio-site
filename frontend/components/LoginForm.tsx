"use client";

import { useActionState } from "react";
import { login } from "@/app/admin/actions";

// A client component only for useActionState, which tracks the pending
// state and the error the login action returns. The form posts straight
// to the Server Action: unlike ContactForm, nothing here calls the backend
// from the browser, so CORS never comes into it.
export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction}>
      <div className="form-field">
        <label htmlFor="password" className="form-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="form-input"
          disabled={pending}
        />
      </div>

      {state?.error && (
        <div className="form-status form-status--error" role="alert">
          {state.error}
        </div>
      )}
      {pending && (
        <div className="form-status" role="status">
          Signing in. If the server is asleep, this can take up to a minute.
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="form-button" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
