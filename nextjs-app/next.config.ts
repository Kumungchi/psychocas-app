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

  // Build optimalizace
  experimental: {
    // Optimalizace pro rychlejší build
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  },

  // Output configuration
  output: 'standalone',
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Suppress workspace root warning
  outputFileTracingRoot: undefined,
};

export default nextConfig;
