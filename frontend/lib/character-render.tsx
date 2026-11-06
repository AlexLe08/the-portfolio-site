import Image from "next/image";
import Link from "next/link";
import type { Portrait } from "@alexle08/eorzean-character-sheet";
import type { LinkRendererProps } from "@alexle08/eorzean-character-sheet/react";

// How the framework-neutral character sheet renders on this site: <Link>
// for client-side navigation, next/image (through the Cloudinary loader)
// for the portrait.

// A job change stays on the same page, so it keeps the scroll position.
export function renderLink({ intent, ...props }: LinkRendererProps) {
  return <Link {...props} scroll={intent === "job" ? false : undefined} />;
}

export function renderPortrait(portrait: Portrait) {
  return <Image src={portrait.src} alt={portrait.alt} fill sizes="15rem" priority />;
}
