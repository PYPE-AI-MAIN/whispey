import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { NextRequest } from 'next/server';

// Force dynamic so Next.js does not attempt to pre-render this route at
// build time — Orama's index is built at runtime from the live source data.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Build the handler lazily per-request so docs index generation errors
  // do not fail module evaluation during `next build`.
  const handlers = createFromSource(source);
  return handlers.GET(request);
}