import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client (service role key required).
 *
 * URL resolution: prefer `SUPABASE_URL` (never prefixed with NEXT_PUBLIC_). That keeps the
 * project URL out of the client JS bundle. This file is only imported from API routes and
 * server modules — the browser uses `/api/data/supabase-select` instead of a Supabase client.
 *
 * `NEXT_PUBLIC_SUPABASE_URL` is supported only as a temporary migration fallback; remove it
 * from `.env` once `SUPABASE_URL` is set.
 *
 * Security note: the Supabase project URL is not a secret (similar to an API hostname). What
 * must stay server-only is `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). Do not expose it.
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL (or legacy NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY',
    )
  }
  return createClient(url, key)
}
