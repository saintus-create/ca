import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run dev` builds into .next-dev so a running preview does not overwrite
  // the production build that `npm run smoke` serves.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // The upstream Open Researcher template ships with pre-existing
  // no-unused-vars lint errors in its own files; don't let its lint
  // debt fail production builds. Template code itself is untouched.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Keep the ~73MB corpus out of the serverless functions. The corpus
  // ships as static assets (public/corpus) and the corpus tool loads
  // it as data at runtime (fs locally, the site's own static URLs on
  // serverless hosts) — it must not be bundled into a function.
  outputFileTracingExcludes: {
    '/api/corpus-search': ['./public/corpus/**'],
    '/api/open-researcher': ['./public/corpus/**'],
    '/api/open-researcher/follow-up': ['./public/corpus/**'],
  },
};

export default nextConfig;
