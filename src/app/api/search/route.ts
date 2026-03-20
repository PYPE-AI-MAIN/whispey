import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

// Force dynamic so Next.js does not attempt to pre-render this route at
// build time — Orama's index is built at runtime from the live source data.
export const dynamic = 'force-dynamic';

export const { GET } = createFromSource(source);