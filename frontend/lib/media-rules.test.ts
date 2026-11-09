import { describe, expect, it } from "vitest";
import {
  ALT_TEXT_MAX_LENGTH,
  checkAltText,
  checkImageFile,
  FORMAT_NAMES,
  MAX_UPLOAD_BYTES,
  TOO_LARGE,
} from "./media-rules";

// A File of the given size without allocating it.
function file(type: string, size = 1024): File {
  const picked = new File([], "picked", { type });
  Object.defineProperty(picked, "size", { value: size });
  return picked;
}

describe("FORMAT_NAMES", () => {
  it("lists every format for the error text", () => {
    expect(FORMAT_NAMES).toBe("JPEG, PNG, WebP, GIF, or AVIF");
  });
});

describe("checkImageFile", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"])("accepts %s", (type) => {
    expect(checkImageFile(file(type))).toBeNull();
  });

  it.each(["image/svg+xml", "application/pdf", ""])("rejects type %j", (type) => {
    expect(checkImageFile(file(type))).toBe(`Pick a ${FORMAT_NAMES} image.`);
  });

  it("allows exactly the upload limit", () => {
    expect(checkImageFile(file("image/png", MAX_UPLOAD_BYTES))).toBeNull();
    expect(checkImageFile(file("image/png", MAX_UPLOAD_BYTES + 1))).toBe(TOO_LARGE);
  });

  it("names the type before the size", () => {
    expect(checkImageFile(file("image/svg+xml", MAX_UPLOAD_BYTES + 1))).toBe(`Pick a ${FORMAT_NAMES} image.`);
  });
});

describe("checkAltText", () => {
  const message = `Alt text is required, up to ${ALT_TEXT_MAX_LENGTH} characters.`;

  it("requires some text", () => {
    expect(checkAltText("")).toBe(message);
  });

  it("allows exactly the backend's column size", () => {
    expect(checkAltText("a".repeat(ALT_TEXT_MAX_LENGTH))).toBeNull();
    expect(checkAltText("a".repeat(ALT_TEXT_MAX_LENGTH + 1))).toBe(message);
  });
});
