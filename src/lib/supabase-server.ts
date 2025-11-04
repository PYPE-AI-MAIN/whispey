// src/lib/supabase-server.ts

import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with the anon key (for regular operations)
 * Call this inside your API route handlers, not at module level
 */
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Creates a Supabase client with the service role key (for admin operations)
 * Call this inside your API route handlers, not at module level
 */
export function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}