'use client'

import type { Filter, InfiniteQueryOptions, QueryOptions } from '@/lib/supabase-query-types'

type AuthHint = { agentId?: string; projectId?: string }

export async function postSupabaseSelect<T = unknown>(payload: {
  table: string
  mode?: 'list' | 'infinite' | 'count'
  query?: {
    select?: string | null
    filters?: Filter[]
    orderBy?: { column: string; ascending: boolean }
    limit?: number
    range?: [number, number]
    pageParam?: unknown
    cursorColumn?: string
    pageSize?: number
  }
  auth?: AuthHint
}): Promise<T[] | number> {
  const res = await fetch('/api/data/supabase-select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table: payload.table,
      mode: payload.mode ?? 'list',
      query: payload.query ?? {},
      auth: payload.auth,
    }),
  })
  const json = (await res.json()) as { data?: T[]; count?: number; error?: string }
  if (!res.ok) {
    throw new Error(json.error || res.statusText)
  }
  if (payload.mode === 'count') {
    return json.count ?? 0
  }
  return (json.data ?? []) as T[]
}

export function queryOptionsWithAuth(
  options: QueryOptions | null | undefined,
  auth?: AuthHint
): (QueryOptions & { auth?: AuthHint }) | null | undefined {
  if (options == null) return options
  return { ...options, auth }
}

export function infiniteOptionsWithAuth(
  options: InfiniteQueryOptions,
  auth?: AuthHint
): InfiniteQueryOptions & { auth?: AuthHint } {
  return { ...options, auth }
}
