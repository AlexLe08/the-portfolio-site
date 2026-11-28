import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// globals.css spells out the dark tokens twice: once for a saved choice
// (:root[data-theme="dark"]) and once for a device set to dark with no
// choice saved. This keeps the copies equal and complete.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function declarations(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} block`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start + selector.length + 2, css.indexOf("}", start));
  return new Map(
    body
      .split(";")
      .map((line) => line.trim())
      .filter((line) => line.includes(":"))
      .map((line) => {
        const colon = line.indexOf(":");
        return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
      }),
  );
}

describe("dark theme tokens", () => {
  const saved = declarations(':root[data-theme="dark"]');
  const device = declarations(":root:not([data-theme])");

  it("are the same for a saved choice and for the device's setting", () => {
    expect(Object.fromEntries(device)).toEqual(Object.fromEntries(saved));
  });

  it("give every color token a dark value", () => {
    const light = declarations(":root");
    const colors = [...light.keys()].filter((name) => /^#[0-9a-f]{6}$/i.test(light.get(name) ?? ""));
    expect(colors.length).toBeGreaterThan(0);
    for (const name of colors) expect(saved.has(name), name).toBe(true);
    expect(saved.get("color-scheme")).toBe("dark");
  });
});

// With no saved choice, ThemeToggle draws both states of its button and
// relies on these rules to hide one, JavaScript or not.
describe("theme toggle hide rules", () => {
  const flat = css.replace(/\s+/g, " ");
  it.each([
    [':root[data-theme="light"] [data-theme-when="dark"]', ""],
    [':root[data-theme="dark"] [data-theme-when="light"]', ""],
    [':root:not([data-theme]) [data-theme-when="dark"]', "@media not all and (prefers-color-scheme: dark) {"],
    [':root:not([data-theme]) [data-theme-when="light"]', "@media (prefers-color-scheme: dark) {"],
  ])("hides %s", (selector, media) => {
    const at = flat.indexOf(selector);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    // The rule's own block hides it...
    expect(flat.slice(at, flat.indexOf("}", at))).toMatch(/\{ display: none; $/);
    // ...under the right media query, if any.
    if (media) expect(flat.slice(0, at).trimEnd().endsWith(media), media).toBe(true);
  });
});
