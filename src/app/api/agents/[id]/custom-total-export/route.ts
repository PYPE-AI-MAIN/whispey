import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { buildCustomTotalExportFilters } from '@/utils/customTotalExportFilters'
import type { CustomTotalConfig } from '@/types/customTotals'

function asObj(v: unknown): Record<string, unknown> {
  try {
    if (!v) return {}
    return typeof v === 'string' ? (JSON.parse(v) as Record<string, unknown>) || {} : (v as Record<string, unknown>)
  } catch {
    return {}
  }
}

function pickJsonValue(obj: Record<string, unknown>, key?: string): unknown {
  if (!obj || !key) return undefined
  if (key in obj) return obj[key]
  const noSpace = key.replace(/\s+/g, '')
  if (noSpace in obj) return obj[noSpace]
  const lowerFirst = key.charAt(0).toLowerCase() + key.slice(1)
  if (lowerFirst in obj) return obj[lowerFirst]
  const found = Object.keys(obj).find((k) => k.toLowerCase() === key.toLowerCase())
  return found ? obj[found] : undefined
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: agentId } = await params
  let body: { config?: CustomTotalConfig; dateFrom?: string; dateTo?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { config, dateFrom, dateTo } = body
  if (!config || !agentId) {
    return NextResponse.json({ error: 'config and agent id required' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: agentRow, error: agentErr } = await supabase
    .from('pype_voice_agents')
    .select('project_id')
    .eq('id', agentId)
    .maybeSingle()

  if (agentErr || !agentRow?.project_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const access = await getProjectRoleForApi(agentRow.project_id as string)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { andFilters, orString } = buildCustomTotalExportFilters(config, agentId, dateFrom, dateTo)

  let query = supabase
    .from('pype_voice_call_logs')
    .select(
      'id,agent_id,customer_number,call_id,call_ended_reason,call_started_at,call_ended_at,duration_seconds,metadata,transcription_metrics,avg_latency,created_at'
    )
    .order('created_at', { ascending: false })
    .limit(2000)

  for (const f of andFilters) {
    switch (f.operator) {
      case 'eq':
        query = query.eq(f.column, f.value)
        break
      case 'ilike':
        query = query.ilike(f.column, f.value as string)
        break
      case 'gte':
        query = query.gte(f.column, f.value)
        break
      case 'lte':
        query = query.lte(f.column, f.value)
        break
      case 'gt':
        query = query.gt(f.column, f.value)
        break
      case 'lt':
        query = query.lt(f.column, f.value)
        break
      case 'not.is':
        query = query.not(f.column, 'is', f.value)
        break
      case 'neq':
        query = query.neq(f.column, f.value)
        break
      default:
        break
    }
  }
  if (orString) {
    query = query.or(orString)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data || []).map((row: Record<string, unknown>) => {
    const tm = asObj(row.transcription_metrics)
    const md = asObj(row.metadata)
    const flattenedMd = Object.fromEntries(
      Object.entries(md).map(([k, v]) => [
        `metadata_${k}`,
        typeof v === 'object' && v !== null ? JSON.stringify(v) : v,
      ])
    )
    const flattenedTm = Object.fromEntries(
      Object.entries(tm).map(([k, v]) => [
        `transcription_${k}`,
        typeof v === 'object' && v !== null ? JSON.stringify(v) : v,
      ])
    )

    return {
      id: row.id,
      customer_number: row.customer_number,
      call_id: row.call_id,
      call_ended_reason: row.call_ended_reason,
      call_started_at: row.call_started_at,
      duration_seconds: row.duration_seconds,
      avg_latency: row.avg_latency,
      ...flattenedMd,
      ...flattenedTm,

      ...(config.jsonField && config.column === 'transcription_metrics'
        ? { [config.jsonField]: pickJsonValue(tm, config.jsonField) }
        : {}),
      ...(config.jsonField && config.column === 'metadata'
        ? { [config.jsonField]: pickJsonValue(md, config.jsonField) }
        : {}),
    }
  })

  return NextResponse.json({ rows })
}
