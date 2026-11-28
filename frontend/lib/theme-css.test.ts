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
