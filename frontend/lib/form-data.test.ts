import { describe, expect, it } from "vitest";
import { formText } from "./form-data";

describe("formText", () => {
  it("trims the field", () => {
    const formData = new FormData();
    formData.set("title", "  Portfolio site \n");
    expect(formText(formData, "title")).toBe("Portfolio site");
  });

  it("reads a missing field as empty", () => {
    expect(formText(new FormData(), "title")).toBe("");
  });
});
