import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const nextConfig: NextConfig = {
  devIndicators: false,
  output: process.env.GITHUB_ACTIONS ? "export" : undefined,
  basePath,
  images: { unoptimized: true },
};
export default nextConfig;
