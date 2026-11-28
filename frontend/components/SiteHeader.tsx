import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PROFILE_LINKS } from "@/lib/links";

// On every page via layout.tsx. Wayfinding only: the home page's title
// block carries the name at full size. The theme toggle sits outside the
// nav, since it isn't a place to go.
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__brand">
          Alexander Le
        </Link>
        <div className="site-header__end">
          <nav className="site-header__nav">
            <Link href="/contact">Contact</Link>
            {/* Plain <a>, not <Link>: these leave the site. Same tab, so the
                browser's back button works the way visitors expect. */}
            <a href={PROFILE_LINKS.github}>GitHub</a>
            <a href={PROFILE_LINKS.linkedin}>LinkedIn</a>
          </nav>
          <ThemeToggle variant="header" />
        </div>
      </div>
    </header>
  );
}
