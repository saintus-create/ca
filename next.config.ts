import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint runs during the build. The previous setting silenced it to hide
  // findings in vendored components; those are excluded in eslint.config.mjs
  // instead, so a real problem in application code fails the build again.
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
