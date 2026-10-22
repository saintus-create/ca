import type { Metadata } from "next";
// Self-hosted Geist (from the `geist` package) instead of `next/font/google`:
// fetching fonts.googleapis.com at build time made `next build` fail outright
// on any network-restricted builder (offline CI, air-gapped runners, some
// container/build caches).
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Researcher",
  description: "California law research with real-time thinking and citations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
