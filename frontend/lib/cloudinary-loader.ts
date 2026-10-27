"use client";

// next/image calls this for every image (images.loaderFile in
// next.config.ts), so Cloudinary resizes and picks the format instead of
// Vercel's optimizer, whose Hobby quota is smaller and fails with a 402
// once spent. Each width is one Cloudinary transformation, cached after the
// first request.
//
// src is a stored media URL, e.g.
//   https://res.cloudinary.com/<cloud>/image/upload/v1/portfolio/name.jpg
// and the transformation goes right after /image/upload/:
//   https://res.cloudinary.com/<cloud>/image/upload/f_auto,c_limit,w_640,q_auto/v1/...
const UPLOAD_SEGMENT = "/image/upload/";

export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  // Anything not on Cloudinary is served as is, at full size.
  if (!src.startsWith("https://res.cloudinary.com/") || !src.includes(UPLOAD_SEGMENT)) {
    return src;
  }
  const params = ["f_auto", "c_limit", `w_${width}`, `q_${quality ?? "auto"}`].join(",");
  return src.replace(UPLOAD_SEGMENT, `${UPLOAD_SEGMENT}${params}/`);
}
