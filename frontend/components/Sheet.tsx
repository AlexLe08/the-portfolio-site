import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  // The page's h1. Without one there's no header (home page, boundaries).
  title?: ReactNode;
  // Under the h1, inside the ruled header.
  header?: ReactNode;
  back?: { href: string; label: string };
  // Above the reading column, at the full sheet width (the home page's
  // character sheet, which centers itself).
  lead?: ReactNode;
  // At the very top, above the lead, at the reading width
  // (FallbackNotice).
  notice?: ReactNode;
  children: ReactNode;
};

// Every page's frame: the sheet, the reading width, an optional back link,
// and the ruled header. Named after the .sheet class, not "Page", which
// would read like the App Router's page.tsx files.
export function Sheet({ title, header, back, lead, notice, children }: Props) {
  return (
    <main className="sheet">
      {notice && <div className="prose-width">{notice}</div>}
      {lead && <div className="sheet__lead">{lead}</div>}
      <div className="prose-width">
        {back && (
          <Link href={back.href} className="back-link">
            {back.label}
          </Link>
        )}
        {title !== undefined && (
          <header className="detail-header">
            <h1 className="detail-header__title">{title}</h1>
            {header}
          </header>
        )}
        {children}
      </div>
    </main>
  );
}
