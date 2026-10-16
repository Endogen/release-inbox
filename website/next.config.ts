import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // A static site for GitHub Pages: every page is rendered to HTML at build time.
  output: "export",
  // Pages serves project sites under /<repository>/; the deploy workflow passes that path.
  basePath: process.env.PAGES_BASE_PATH || undefined,
  // /code-signing/ is served as code-signing/index.html, which static hosts resolve.
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
