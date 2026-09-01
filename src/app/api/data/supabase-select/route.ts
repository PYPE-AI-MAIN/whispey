import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { authorizeTableSelect, isAllowedTable } from '@/lib/supabase-select-auth'
import { filterSelectColumns, stripDisallowedColumns, type CallLogSettings } from '@/lib/callLogSettings'
import { resolveColumnAccessForRequest } from '@/lib/agentCallLogSettingsStore'

type Filter = { column: string; operator: string; value: unknown }

function applyFilters(query: any, filters: Filter[]) {
  let q = query
  for (const filter of filters) {
    switch (filter.operator) {
      case 'eq':
        q = q.eq(filter.column, filter.value)
        break
      case 'neq':
      case '<>':
        q = q.neq(filter.column, filter.value)
        break
      case 'gt':
        q = q.gt(filter.column, filter.value)
        break
      case 'gte':
        q = q.gte(filter.column, filter.value)
        break
      case 'lt':
        q = q.lt(filter.column, filter.value)
        break
      case 'lte':
        q = q.lte(filter.column, filter.value)
        break
      case 'like':
        q = q.like(filter.column, filter.value as string)
        break
      case 'ilike':
        q = q.ilike(filter.column, filter.value)
        break
      case 'in':
        q = q.in(filter.column, filter.value)
        break
      case 'not.is':
        q = q.not(filter.column, 'is', filter.value)
        break
      default:
        break
    }
  }
  return q
}

type RequestBody = {
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
  auth?: { agentId?: string; projectId?: string }
}

async function parseRequestBody(request: NextRequest): Promise<RequestBody | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

// This generic route is the only fetch path (besides the dedicated
// agent/project call-logs query routes) that can return
// `pype_voice_call_logs` rows — e.g. the observability/session-detail page
// fetches a single call log by id through here. It must enforce the same
// per-agent/per-user column restrictions (`call_log_settings`) those
// dedicated routes apply, otherwise a column hidden there (like
// `customer_number`) leaks through this path unrestricted.
async function resolveDisallowedColumns(
  table: string,
  agentId: string | undefined,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<Set<string>> {
  if (table !== 'pype_voice_call_logs' || !agentId) return new Set()

  const { userId } = await auth()
  if (!userId) return new Set()

  const [{ data: agentRow }, user] = await Promise.all([
    supabase.from('pype_voice_agents').select('call_log_settings').eq('id', agentId).maybeSingle(),
    currentUser(),
  ])
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? null

  const access = await resolveColumnAccessForRequest({
    userId,
    userEmail,
    callLogSettings: (agentRow?.call_log_settings as CallLogSettings | null) ?? null,
    isDownload: false,
  })
  return access.disallowedColumns
}

async function handleCountMode(
  supabase: ReturnType<typeof createServiceRoleClient>,
  table: string,
  filters: Filter[]
) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  q = applyFilters(q, filters)
  const { count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: count ?? 0 })
}

async function handleInfiniteMode(
  supabase: ReturnType<typeof createServiceRoleClient>,
  table: string,
  effectiveSelect: string,
  disallowedColumns: Set<string>,
  query: NonNullable<RequestBody['query']>
) {
  const { filters = [], orderBy, pageParam, cursorColumn, pageSize } = query
  let q = supabase.from(table).select(effectiveSelect)
  q = applyFilters(q, filters)
  if (pageParam !== undefined && pageParam !== null && cursorColumn) {
    q = q.gt(cursorColumn, pageParam)
  }
  if (orderBy) {
    q = q.order(orderBy.column, { ascending: orderBy.ascending })
  }
  if (pageSize) q = q.limit(pageSize)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: stripDisallowedColumns((data ?? []) as unknown as Record<string, unknown>[], disallowedColumns) })
}

async function handleListMode(
  supabase: ReturnType<typeof createServiceRoleClient>,
  table: string,
  effectiveSelect: string,
  disallowedColumns: Set<string>,
  query: NonNullable<RequestBody['query']>
) {
  const { filters = [], orderBy, limit, range } = query
  let q = supabase.from(table).select(effectiveSelect)
  q = applyFilters(q, filters)
  if (orderBy) {
    q = q.order(orderBy.column, { ascending: orderBy.ascending })
  }
  if (range && range.length === 2) {
    q = q.range(range[0], range[1])
  } else if (limit) {
    q = q.limit(limit)
  }
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: stripDisallowedColumns((data ?? []) as unknown as Record<string, unknown>[], disallowedColumns) })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await parseRequestBody(request)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { table, mode = 'list', query = {}, auth: authHint } = body
  if (!table || !isAllowedTable(table)) {
    return NextResponse.json({ error: 'Table not allowed' }, { status: 400 })
  }

  const { select = '*', filters = [] } = query
  if (filters.some((f) => f.value === 'never-match')) {
    return mode === 'count' ? NextResponse.json({ count: 0 }) : NextResponse.json({ data: [] })
  }

  const authz = await authorizeTableSelect(table, filters, authHint)
  if (!authz.ok) return authz.response

  const supabase = createServiceRoleClient()

  if (mode === 'count') {
    return handleCountMode(supabase, table, filters)
  }

  const disallowedColumns = await resolveDisallowedColumns(table, authz.agentId, supabase)
  const effectiveSelect = filterSelectColumns(select || '*', disallowedColumns) as string

  if (mode === 'infinite') {
    return handleInfiniteMode(supabase, table, effectiveSelect, disallowedColumns, query)
  }
  return handleListMode(supabase, table, effectiveSelect, disallowedColumns, query)
}
