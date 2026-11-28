import Image from "next/image";
import Link from "next/link";
import type { Portrait } from "@solution-nine/wol-character-panel";
import type { LinkRendererProps } from "@solution-nine/wol-character-panel/react";

// How the framework-neutral character sheet renders on this site: <Link>
// for client-side navigation, next/image (through the Cloudinary loader)
// for the portrait.

// A job or tab change stays on the same page, so it keeps the scroll
// position, and so does a param action without a #target. scroll={false}
// also skips the scroll to a #target, so a param action with one keeps the
// default. A "page" link goes to another path and scrolls to its top.
export function renderLink({ intent, ...props }: LinkRendererProps) {
  const keepScroll =
    intent === "job" || intent === "tab" || (intent === "param" && !props.href.includes("#"));
  return <Link {...props} scroll={keepScroll ? false : undefined} />;
}

export function renderPortrait(portrait: Portrait) {
  return <Image src={portrait.src} alt={portrait.alt} fill sizes="15rem" priority />;
}
