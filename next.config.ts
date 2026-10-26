import type { NextConfig } from "next";

// GitHub Pages serves a static copy of the site under /<repo>/. The Pages workflow sets
// GITHUB_PAGES=true; local dev and other hosts are unaffected.
const pages = process.env.GITHUB_PAGES === "true";
const basePath = pages ? "/host-observability" : "";

const nextConfig: NextConfig = {
  ...(pages ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
  basePath,
};

export default nextConfig;
