import Link from "next/link";

// A plain Server Component -- no interactivity needed, so no "use client"
// and no client-side JS shipped for this at all. Rendered once, in
// layout.tsx, so it's present on every route without each page needing
// its own copy. Kept deliberately understated: the title block on the
// home page already carries the name at full size, so this is wayfinding,
// not a second hero.
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__brand">
          Alexander Le
        </Link>
        <nav className="site-header__nav">
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
    </header>
  );
}