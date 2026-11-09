import { describe, expect, it } from "vitest";
import cloudinaryLoader from "./cloudinary-loader";

const stored = "https://res.cloudinary.com/demo/image/upload/v1/portfolio/name.jpg";

describe("cloudinaryLoader", () => {
  it("adds the transformation right after /image/upload/", () => {
    expect(cloudinaryLoader({ src: stored, width: 640 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,c_limit,w_640,q_auto/v1/portfolio/name.jpg",
    );
  });

  it("passes a quality through", () => {
    expect(cloudinaryLoader({ src: stored, width: 1080, quality: 75 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,c_limit,w_1080,q_75/v1/portfolio/name.jpg",
    );
  });

  it.each([
    ["another host", "https://example.com/image/upload/v1/name.jpg"],
    ["a local file", "/portrait.png"],
    ["plain http", "http://res.cloudinary.com/demo/image/upload/v1/name.jpg"],
    ["another Cloudinary path", "https://res.cloudinary.com/demo/video/upload/v1/clip.mp4"],
  ])("serves %s as is", (_, src) => {
    expect(cloudinaryLoader({ src, width: 640 })).toBe(src);
  });
});
