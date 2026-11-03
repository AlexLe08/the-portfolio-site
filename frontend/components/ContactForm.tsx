"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { components } from "@/lib/api-types";
import { describeRetryAfter, SERVER_UNREACHABLE } from "@/lib/messages";

// The only backend call made from the browser, so the only one CORS
// applies to: every other call runs on the server (pages and Server
// Actions). A CORS error in the console means Render's ALLOWED_ORIGINS
// lacks this page's origin (see docs/render-runbook.md).
type Status = "idle" | "submitting" | "success" | "error";

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  email: "email address",
  message: "message",
};

const GENERIC_ERROR = "The message wasn't sent. Check the email address and try again.";

// Turns the first 422 validation error from the backend into a specific
// message. The limits come from the error's own `ctx`, so schemas.py stays
// the single source of truth. Anything unrecognized (e.g. a bad email)
// falls back to the generic message.
function describeValidationError(
  detail: components["schemas"]["ValidationError"][] | undefined,
): string {
  const first = detail?.[0];
  const field = first && FIELD_LABELS[String(first.loc.at(-1))];
  if (!first || !field) return GENERIC_ERROR;

  if (first.type === "string_too_short") {
    return `Please enter your ${field}.`;
  }
  if (first.type === "string_too_long") {
    const { max_length } = (first.ctx ?? {}) as { max_length?: number };
    if (!max_length) return `Your ${field} is too long.`;
    const yours = typeof first.input === "string" ? ` (yours is ${first.input.length})` : "";
    return `Your ${field} is too long. The limit is ${max_length} characters${yours}.`;
  }
  return GENERIC_ERROR;
}

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot: hidden from people, filled in by form-filling bots.
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const { error, response } = await api.POST("/contact", {
        body: { name, email, message, website },
      });
      if (response.status === 429) {
        // Not in the OpenAPI error shapes, so matched by status. Reading
        // Retry-After needs CORS expose_headers on the backend.
        setStatus("error");
        const wait = describeRetryAfter(response.headers.get("Retry-After"));
        setErrorMessage(`Too many messages from your connection. Please try again ${wait}.`);
        return;
      }
      if (error) {
        // `error` is the typed 422 validation shape from the OpenAPI spec.
        // Real network failures (backend asleep, CORS block) throw instead
        // and are handled in the catch below.
        setStatus("error");
        setErrorMessage(describeValidationError(error.detail));
        return;
      }
      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
      setErrorMessage(SERVER_UNREACHABLE);
    }
  }

  if (status === "success") {
    return (
      <div className="form-status form-status--success" role="status">
        Message sent. I&rsquo;ll reply by email.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="name" className="form-label">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input"
          disabled={status === "submitting"}
        />
      </div>

      <div className="form-field">
        <label htmlFor="email" className="form-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="form-input"
          disabled={status === "submitting"}
        />
      </div>

      <div className="form-field">
        <label htmlFor="message" className="form-label">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="form-input form-textarea"
          disabled={status === "submitting"}
        />
      </div>

      {/* aria-hidden + tabIndex -1 keep it away from screen readers and
          keyboard users; it is positioned off-screen in CSS rather than
          type="hidden" or display:none, which many bots skip. */}
      <div className="form-hp" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {status === "error" && (
        <div className="form-status form-status--error" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="form-button"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
