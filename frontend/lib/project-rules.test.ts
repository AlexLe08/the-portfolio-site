import { describe, expect, it } from "vitest";
import { isValidSlug, MAX_LENGTH } from "./project-rules";

describe("isValidSlug", () => {
  it.each(["portfolio-site", "a", "v2", "api-2-beta"])("accepts %j", (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["uppercase", "Portfolio"],
    ["leading hyphen", "-site"],
    ["trailing hyphen", "site-"],
    ["double hyphen", "my--site"],
    ["space", "my site"],
    ["underscore", "my_site"],
    ["line break", "site\nother"],
  ])("rejects %s", (_, slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });

  it("allows exactly the backend's column size", () => {
    expect(isValidSlug("a".repeat(MAX_LENGTH.slug))).toBe(true);
    expect(isValidSlug("a".repeat(MAX_LENGTH.slug + 1))).toBe(false);
  });
});
