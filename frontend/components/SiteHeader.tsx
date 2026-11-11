import Link from "next/link";
import { PROFILE_LINKS } from "@/lib/links";

// On every page via layout.tsx. Wayfinding only: the home page's title
// block carries the name at full size.
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__brand">
          Alexander Le
        </Link>
        <nav className="site-header__nav">
          <Link href="/contact">Contact</Link>
          {/* Plain <a>, not <Link>: these leave the site. Same tab, so the
              browser's back button works the way visitors expect. */}
          <a href={PROFILE_LINKS.github}>GitHub</a>
          <a href={PROFILE_LINKS.linkedin}>LinkedIn</a>
        </nav>
      </div>
    </header>
  );
}