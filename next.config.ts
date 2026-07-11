import type { NextConfig } from "next";

const isTauri = process.env.TAURI_BUILD === 'true';

const nextConfig: NextConfig = {
  output: isTauri ? "export" : "standalone",
  outputFileTracingRoot: isTauri ? undefined : process.cwd(),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;