import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Don't let `next dev` write AGENTS.md; project docs live in README.md.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
