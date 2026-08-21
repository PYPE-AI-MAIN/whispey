import { createMDX } from 'fumadocs-mdx/next';
import path from 'path';

const withMDX = createMDX();

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
    // ponytail: temporarily false to get full local-parity logging on EC2
    // stage while debugging restore/webhook. Switch back to
    // `{ exclude: ['error', 'warn'] }` once that investigation is done —
    // don't ship a blanket `false` long-term (see incident notes above).
    removeConsole: false
  },
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*', 
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default withMDX(config);