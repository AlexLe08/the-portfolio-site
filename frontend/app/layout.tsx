import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { FALLBACK_CONTENT } from "@/lib/content";
import "./globals.css";

// IBM Plex isn't a variable font on Google Fonts, so weights must be
// listed explicitly. Plex Sans carries both headlines and body copy --
// one family, not a display/body split, kept legible with a deliberate
// weight range. Plex Mono is scoped narrowly in globals.css to places
// something is literally a technical identifier (stack tags, the title
// block's metadata row) -- not used as generic small-label decoration.
const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Pages set only their own title ("Contact"); the template adds the name.
// The description is the built-in copy: the home page replaces it with the
// stored value, but reading /content here would hold up every route.
export const metadata: Metadata = {
  title: { default: "Alexander Le — Portfolio", template: "%s — Alexander Le" },
  description: FALLBACK_CONTENT["site.description"],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}