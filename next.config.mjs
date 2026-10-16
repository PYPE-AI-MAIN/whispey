import path from 'path';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // ESLint during `next build` is the main memory hog behind the Vercel build
  // OOM (SIGKILL at "Linting and checking validity of types"). Lint is already
  // enforced by the dedicated CI `lint` job, so running it again in the build
  // is redundant. TypeScript type-checking stays ON — the build still fails on
  // type errors. ponytail: if type-check also OOMs, bump NODE_OPTIONS
  // (--max-old-space-size) via a Vercel env var, or raise the build machine size.
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve('./src'),
    };
    return config;
  },
  compiler:{
    removeConsole:process.env.NODE_ENV === 'production'
  },
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [{ source: '/docs/:path*', destination: 'https://docs.whispey.pypeai.com/:path*', permanent: true }];
  },
};

export default config;