import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { authorizeTableSelect, isAllowedTable } from '@/lib/supabase-select-auth'

type Filter = { column: string; operator: string; value: unknown }

function applyFilters(query: any, filters: Filter[]) {
  let q = query
  for (const filter of filters) {
    switch (filter.operator) {
      case 'eq':
        q = q.eq(filter.column, filter.value)
        break
      case 'neq':
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

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
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

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { table, mode = 'list', query = {}, auth: authHint } = body
  if (!table || !isAllowedTable(table)) {
    return NextResponse.json({ error: 'Table not allowed' }, { status: 400 })
  }

  const { select = '*', filters = [], orderBy, limit, range, pageParam, cursorColumn, pageSize } = query
  if (filters.some((f) => f.value === 'never-match')) {
    if (mode === 'count') return NextResponse.json({ count: 0 })
    return NextResponse.json({ data: [] })
  }

  const authz = await authorizeTableSelect(table, filters, authHint)
  if (!authz.ok) return authz.response

  const supabase = createServiceRoleClient()

  if (mode === 'count') {
    let q = supabase.from(table).select('*', { count: 'exact', head: true })
    q = applyFilters(q, filters)
    const { count, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ count: count ?? 0 })
  }

  if (mode === 'infinite') {
    let q = supabase.from(table).select(select || '*')
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
    return NextResponse.json({ data: data ?? [] })
  }

  let q = supabase.from(table).select(select || '*')
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
  return NextResponse.json({ data: data ?? [] })
}
