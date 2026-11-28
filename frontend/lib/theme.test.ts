import { describe, expect, it } from "vitest";
import { readTheme } from "./theme";

describe("readTheme", () => {
  it("accepts the two themes", () => {
    expect(readTheme("light")).toBe("light");
    expect(readTheme("dark")).toBe("dark");
  });

  it("treats anything else as no choice", () => {
    for (const value of [undefined, null, "", "Dark", " dark", "system", "auto", ["dark"], 1]) {
      expect(readTheme(value)).toBeUndefined();
    }
  });
});
