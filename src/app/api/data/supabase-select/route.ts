import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { authorizeTableSelect, isAllowedTable } from '@/lib/supabase-select-auth'
import { withDataPlane, rethrowDataPlane, isCallDataTable, isCallLogsTable, type DataPlane, type SelectQuery } from '@/server/data-plane'
import { filterSelectColumns, stripDisallowedColumns, type CallLogSettings } from '@/lib/callLogSettings'
import { resolveColumnAccessForRequest } from '@/lib/agentCallLogSettingsStore'
import type { Filter } from '@/lib/supabase-query-types'
import { applyFilters } from '@/server/data-plane/adapters/queryPlane'


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
// call-log rows — e.g. the observability/session-detail page
// fetches a single call log by id through here. It must enforce the same
// per-agent/per-user column restrictions (`call_log_settings`) those
// dedicated routes apply, otherwise a column hidden there (like
// `customer_number`) leaks through this path unrestricted.
async function resolveDisallowedColumns(
  table: string,
  agentId: string | undefined,
  supabase: Supabase
): Promise<Set<string>> {
  if (!isCallLogsTable(table) || !agentId) return new Set()

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

type Supabase = ReturnType<typeof createServiceRoleClient>

// Control-plane tables read straight from Pype; call-data tables go through the
// project's data plane. Both take the same filter/order/range shape.
async function readRows(
  plane: DataPlane | null,
  supabase: Supabase,
  table: string,
  q: SelectQuery
): Promise<Record<string, unknown>[]> {
  if (plane) return plane.callData.selectRows(table, q)
  let query: any = applyFilters(supabase.from(table).select(q.select || '*'), q.filters ?? [])
  if (q.cursor) query = query.gt(q.cursor.column, q.cursor.value)
  if (q.orderBy) query = query.order(q.orderBy.column, { ascending: q.orderBy.ascending })
  if (q.range) query = query.range(q.range[0], q.range[1])
  else if (q.limit) query = query.limit(q.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Record<string, unknown>[]
}

async function countRows(plane: DataPlane | null, supabase: Supabase, table: string, filters: Filter[]): Promise<number> {
  if (plane) return plane.callData.countRows(table, filters)
  const { count, error } = await applyFilters(supabase.from(table).select('*', { count: 'exact', head: true }), filters)
  if (error) throw new Error(error.message)
  return count ?? 0
}

function toSelectQuery(mode: 'list' | 'infinite', effectiveSelect: string, query: NonNullable<RequestBody['query']>): SelectQuery {
  const { filters = [], orderBy } = query
  if (mode === 'infinite') {
    const { pageParam, cursorColumn, pageSize } = query
    return {
      select: effectiveSelect,
      filters: filters,
      orderBy,
      limit: pageSize,
      cursor: pageParam !== undefined && pageParam !== null && cursorColumn ? { column: cursorColumn, value: pageParam } : undefined,
    }
  }
  const { limit, range } = query
  return { select: effectiveSelect, filters: filters, orderBy, limit, range: range && range.length === 2 ? range : undefined }
}

export const POST = withDataPlane(async (dp, request: NextRequest) => {
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
  const plane = isCallDataTable(table) ? await dp.forProject(authz.projectId) : null

  try {
    if (mode === 'count') {
      return NextResponse.json({ count: await countRows(plane, supabase, table, filters) })
    }

    const disallowedColumns = await resolveDisallowedColumns(table, authz.agentId, supabase)
    const effectiveSelect = filterSelectColumns(select || '*', disallowedColumns) as string
    const rows = await readRows(plane, supabase, table, toSelectQuery(mode === 'infinite' ? 'infinite' : 'list', effectiveSelect, query))
    return NextResponse.json({ data: stripDisallowedColumns(rows, disallowedColumns) })
  } catch (e) {
    rethrowDataPlane(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
})
