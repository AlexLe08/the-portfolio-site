"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";

// Everything in this file runs in the browser, not on the server -- the
// "use client" directive above is what makes that possible. This is the
// first component in the project that needs it: useState and a submit
// handler both require interactivity no Server Component can provide.
// It's also the first place a fetch from this frontend actually crosses
// the browser's CORS boundary -- every page so far fetched server-to-server,
// where CORS doesn't apply at all. If this form fails with a CORS error
// in the browser console, it means Render's ALLOWED_ORIGINS doesn't
// include the origin this page is served from (see docs/render-runbook.md).
type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const { error } = await api.POST("/contact", {
      body: { name, email, message },
    });

    if (error) {
      // `error` here is the typed 422 validation-error shape from the
      // OpenAPI spec -- not a generic catch. A real network failure
      // (backend asleep, CORS block) throws instead of returning `error`,
      // which is why that case is handled separately in the catch below.
      setStatus("error");
      setErrorMessage(
        "The message wasn't sent. Check the email address and try again.",
      );
      return;
    }

    setStatus("success");
    setName("");
    setEmail("");
    setMessage("");
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