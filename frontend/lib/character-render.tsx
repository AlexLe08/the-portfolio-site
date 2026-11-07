import Image from "next/image";
import Link from "next/link";
import type { Portrait } from "@alexle08/eorzean-character-sheet";
import type { LinkRendererProps } from "@alexle08/eorzean-character-sheet/react";

// How the framework-neutral character sheet renders on this site: <Link>
// for client-side navigation, next/image (through the Cloudinary loader)
// for the portrait.

// A job change stays on the same page, so it keeps the scroll position, and
// so does a param action without a #target. scroll={false} also skips the
// scroll to a #target, so a param action with one keeps the default.
export function renderLink({ intent, ...props }: LinkRendererProps) {
  const keepScroll = intent === "job" || (intent === "param" && !props.href.includes("#"));
  return <Link {...props} scroll={keepScroll ? false : undefined} />;
}

export function renderPortrait(portrait: Portrait) {
  return <Image src={portrait.src} alt={portrait.alt} fill sizes="15rem" priority />;
}
