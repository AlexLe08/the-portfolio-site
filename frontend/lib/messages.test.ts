import { describe, expect, it } from "vitest";
import { describeRetryAfter, describeSaveFailure } from "./messages";

describe("describeRetryAfter", () => {
  it.each([
    ["1", "in a minute"],
    ["60", "in a minute"],
    ["61", "in 2 minutes"],
    ["720", "in 12 minutes"],
    ["3540", "in 59 minutes"],
    ["3541", "in about an hour"],
    ["5340", "in about an hour"],
    ["5341", "in about 2 hours"],
  ])("reads %s seconds as %j", (header, text) => {
    expect(describeRetryAfter(header)).toBe(text);
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["zero", "0"],
    ["negative", "-5"],
    ["an HTTP date", "Wed, 21 Oct 2026 07:28:00 GMT"],
    ["infinite", "Infinity"],
  ])("falls back to later when %s", (_, header) => {
    expect(describeRetryAfter(header)).toBe("later");
  });
});

describe("describeSaveFailure", () => {
  it("lists each failing field of a 422", () => {
    const error = {
      detail: [
        { loc: ["body", "slug"], msg: "String should match pattern", type: "string_pattern_mismatch" },
        { loc: ["body", "title"], msg: "Field required", type: "missing" },
      ],
    };
    expect(describeSaveFailure(new Response(null, { status: 422 }), error)).toBe(
      "slug: String should match pattern title: Field required",
    );
  });

  it("falls back to the status for a 422 without details", () => {
    expect(describeSaveFailure(new Response(null, { status: 422 }), { detail: [] })).toBe(
      "Saving failed (HTTP 422).",
    );
    expect(describeSaveFailure(new Response(null, { status: 422 }), undefined)).toBe("Saving failed (HTTP 422).");
  });

  it("gives the status for anything else", () => {
    const error = { detail: [{ loc: ["body", "slug"], msg: "taken", type: "x" }] };
    expect(describeSaveFailure(new Response(null, { status: 409 }), error)).toBe("Saving failed (HTTP 409).");
  });
});
