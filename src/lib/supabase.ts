"use client"
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

/**
 * Returns a Supabase client. On the server uses SUPABASE_URL / SUPABASE_ANON_KEY.
 * In the browser fetches config from /api/supabase-config (so you can use SUPABASE_* env vars only).
 */
export async function getSupabase(): Promise<SupabaseClient> {
  if (cachedClient) return cachedClient

  if (typeof window === 'undefined') {
    const url = process.env.SUPABASE_URL!
    const key = process.env.SUPABASE_ANON_KEY!
    cachedClient = createClient(url, key)
    return cachedClient
  }

  const res = await fetch('/api/supabase-config')
  if (!res.ok) throw new Error('Failed to load Supabase config')
  const { url, anonKey } = await res.json()
  cachedClient = createClient(url, anonKey)
  return cachedClient
}

/**
 * Server-only: synchronous client. Do not use in client components; use getSupabase() there.
 */
export const supabase =
  typeof window === 'undefined'
    ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
    : (null as unknown as SupabaseClient)
