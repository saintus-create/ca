import type { Metadata } from "next";
// Self-hosted type (fontsource packages) instead of next/font/google:
// fetching fonts.googleapis.com at build time made `next build` fail outright
// on any network-restricted builder. Public Sans is the typeface of the
// California state design system; Source Serif 4 carries quoted statutory
// text. Both are wired to the --font-sans and --font-serif tokens in
// globals.css, so the tokens are the single place the site's type is set.
import "@fontsource-variable/public-sans";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/400-italic.css";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "California Legislative Information",
  description: "The California codes, the Rules of Court and the Judicial Council forms, with answers cited to the section.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
