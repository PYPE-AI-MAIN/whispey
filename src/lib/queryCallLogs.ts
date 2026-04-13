import type { SupabaseClient } from '@supabase/supabase-js'

type RpcFilter = { column: string; operator: string; value: unknown }

function applyFilters(query: any, filters: RpcFilter[]) {
  let q = query
  for (const f of filters) {
    switch (f.operator) {
      case 'eq':    q = q.eq(f.column, f.value); break
      case 'neq':
      case '<>':    q = q.neq(f.column, f.value); break
      case 'gt':    q = q.gt(f.column, f.value); break
      case 'gte':   q = q.gte(f.column, f.value); break
      case 'lt':    q = q.lt(f.column, f.value); break
      case 'lte':   q = q.lte(f.column, f.value); break
      case 'ilike': q = q.ilike(f.column, f.value as string); break
      case 'like':  q = q.like(f.column, f.value as string); break
      case 'in':    q = q.in(f.column, f.value as unknown[]); break
      case 'not.is': q = q.not(f.column, 'is', f.value); break
    }
  }
  return q
}

export interface CallLogsQueryParams {
  p_agent_id: string
  p_pre_distinct_filters: RpcFilter[]
  p_post_distinct_filters: RpcFilter[]
  p_select: string
  p_order_by_column: string
  p_order_ascending: boolean
  p_limit: number
  p_offset: number
  p_distinct_column: string | null
  p_distinct_json_field: string | null
  p_distinct_order: string
  p_date_from: string | null
  p_date_to: string | null
}

export async function queryCallLogs(supabase: SupabaseClient, params: CallLogsQueryParams) {
  const {
    p_agent_id,
    p_pre_distinct_filters,
    p_post_distinct_filters,
    p_select,
    p_order_by_column,
    p_order_ascending,
    p_limit,
    p_offset,
    p_distinct_column,
    p_distinct_json_field,
    p_date_from,
    p_date_to,
    p_distinct_order,
  } = params

  const hasDistinct = !!p_distinct_column

  let query = (supabase as any)
    .from('pype_voice_call_logs')
    .select(p_select || '*')
    .eq('agent_id', p_agent_id)

  if (p_date_from) query = query.gte('call_started_at', `${p_date_from} 00:00:00`)
  if (p_date_to)   query = query.lte('call_started_at', `${p_date_to} 23:59:59.999`)

  query = applyFilters(query, p_pre_distinct_filters)

  if (!hasDistinct) {
    query = applyFilters(query, p_post_distinct_filters)
    query = query.order(p_order_by_column || 'created_at', { ascending: !!p_order_ascending })
    query = query.range(p_offset, p_offset + p_limit - 1)
    return query as Promise<{ data: any[] | null; error: any }>
  }

  // DISTINCT ON is not supported by the PostgREST query builder.
  // Fetch a broad result set ordered by the distinct column, then deduplicate in JS.
  if (!p_distinct_json_field) {
    query = query.order(p_distinct_column!, { ascending: p_distinct_order === 'asc' })
  }
  if (p_order_by_column && p_order_by_column !== p_distinct_column) {
    query = query.order(p_order_by_column, { ascending: !!p_order_ascending })
  }
  // Cap the fetch at 10k rows to avoid runaway queries
  query = query.range(0, 9999)

  const { data, error } = await query
  if (error) return { data: null as any, error }

  let rows: any[] = data || []

  // Apply post-distinct filters in JS
  for (const f of p_post_distinct_filters) {
    rows = filterRowsInJS(rows, f)
  }

  // Deduplicate keeping the first occurrence (matches DISTINCT ON semantics when ordered)
  const seen = new Set<string>()
  const deduped = rows.filter(row => {
    const raw = p_distinct_json_field
      ? (row[p_distinct_column!] as any)?.[p_distinct_json_field]
      : row[p_distinct_column!]
    const key = String(raw ?? '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { data: deduped.slice(p_offset, p_offset + p_limit), error: null }
}

function filterRowsInJS(rows: any[], f: RpcFilter): any[] {
  return rows.filter(row => {
    const val = row[f.column as string]
    switch (f.operator) {
      case 'eq':    return String(val ?? '') === String(f.value ?? '')
      case 'neq':
      case '<>':    return String(val ?? '') !== String(f.value ?? '')
      case 'gt':    return Number(val) > Number(f.value)
      case 'gte':   return Number(val) >= Number(f.value)
      case 'lt':    return Number(val) < Number(f.value)
      case 'lte':   return Number(val) <= Number(f.value)
      case 'ilike': return String(val ?? '').toLowerCase().includes(
                      String(f.value ?? '').replace(/%/g, '').toLowerCase()
                    )
      case 'not.is': return val !== null && val !== undefined
      default:      return true
    }
  })
}
