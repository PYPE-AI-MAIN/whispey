import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Skip ESLint during builds to avoid blocking on lint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Optional: skip type errors during production build if needed
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
