import type { Metadata } from "next";

// Metadata only. Auth checks live in each page and action (see
// verifySession in lib/session.ts), because a layout doesn't re-run on
// every navigation and doesn't guard Server Actions at all.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
