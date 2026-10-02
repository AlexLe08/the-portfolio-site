import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
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

export const metadata: Metadata = {
  title: "Alexander Le — Portfolio",
  description: "Full-stack case studies and projects.",
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