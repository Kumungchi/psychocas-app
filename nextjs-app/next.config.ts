import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimální konfigurace pro stabilní build
  reactStrictMode: true,
  
  // TypeScript - povolit errory během development, ale ne při buildu
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint - ignorovat během buildu (aby build neselhal na warnings)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
