import type { NextConfig } from "next";

/**
 * GitHub Pages serves project sites from a subpath and cannot run a server,
 * so the app is exported as static files. NEXT_PUBLIC_BASE_PATH carries the
 * repository name at build time; it is empty for local development.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/api-meter";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
