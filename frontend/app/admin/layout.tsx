import type { Metadata } from "next";

// Metadata only. Auth checks live in each page and action (see
// verifySession in lib/session.ts), because a layout doesn't re-run on
// every navigation and doesn't guard Server Actions at all.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  // /admin itself sets no title, so it gets "Admin — Alexander Le" from the
  // root template; pages under it read "Site content — Admin".
  title: { default: "Admin", template: "%s — Admin" },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
