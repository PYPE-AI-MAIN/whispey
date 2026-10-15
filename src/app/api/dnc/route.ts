import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { DNC_TABLE, getSuperAdminEmail, toNumbersArray, buildDncRows, type DncScope } from '@/lib/dnc'

export const runtime = 'nodejs'

/**
 * POST /api/dnc
 * Body: {
 *   numbers: string | string[],   // one or many (CSV upload sends many)
 *   scope: 'global' | 'project' | 'agent',
 *   project_id?: string,          // required when scope='project'
 *   agent_id?: string,            // required when scope='agent' (its project is looked up)
 *   reason?: string,
 *   source?: 'manual' | 'csv' | 'api'
 * }
 * Superadmin only. Adds numbers to the DNC list. Duplicates within a scope are
 * skipped (the partial unique index also enforces this at the DB level).
 */
export async function POST(request: NextRequest) {
  const admin = await getSuperAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    numbers?: string | string[]
    scope?: DncScope
    project_id?: string
    agent_id?: string
    reason?: string
    source?: 'manual' | 'csv' | 'api'
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const scope = body.scope
  if (scope !== 'global' && scope !== 'project' && scope !== 'agent') {
    return NextResponse.json({ error: "scope must be 'global', 'project' or 'agent'" }, { status: 400 })
  }
  if (scope === 'project' && !body.project_id) {
    return NextResponse.json({ error: 'project_id is required for project scope' }, { status: 400 })
  }
  if (scope === 'agent' && !body.agent_id) {
    return NextResponse.json({ error: 'agent_id is required for agent scope' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // An agent entry belongs to the agent's own project, whatever the client sent.
  let projectId = body.project_id ?? null
  if (scope === 'agent') {
    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('project_id')
      .eq('id', body.agent_id!)
      .maybeSingle()
    if (agentError || !agent?.project_id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 400 })
    }
    projectId = agent.project_id
  }

  const inputs = toNumbersArray(body.numbers)
  if (inputs.length === 0) {
    return NextResponse.json({ error: '`numbers` is required' }, { status: 400 })
  }

  const { rows, invalid } = buildDncRows(inputs, {
    scope,
    projectId,
    agentId: body.agent_id ?? null,
    reason: body.reason ?? null,
    source: body.source ?? 'manual',
    addedBy: admin,
  })

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid numbers', invalid }, { status: 400 })
  }

  // Skip numbers already active in this scope so we don't trip the unique index.
  let existingQuery = supabase
    .from(DNC_TABLE)
    .select('phone_e164')
    .eq('is_active', true)
    .eq('scope', scope)
    .in('phone_e164', rows.map((r) => r.phone_e164 as string))
  if (scope === 'project') existingQuery = existingQuery.eq('project_id', projectId!)
  if (scope === 'agent') existingQuery = existingQuery.eq('agent_id', body.agent_id!)
  const existing = await existingQuery
  if (existing.error) {
    console.error('DNC add (dupe check) error:', existing.error)
    return NextResponse.json({ error: 'Failed to add numbers' }, { status: 500 })
  }
  const already = new Set((existing.data ?? []).map((r) => r.phone_e164))
  const toInsert = rows.filter((r) => !already.has(r.phone_e164 as string))

  if (toInsert.length > 0) {
    const { error } = await supabase.from(DNC_TABLE).insert(toInsert)
    if (error) {
      console.error('DNC add (insert) error:', error)
      return NextResponse.json({ error: 'Failed to add numbers' }, { status: 500 })
    }
  }

  return NextResponse.json({
    added: toInsert.length,
    skipped_duplicates: rows.length - toInsert.length,
    invalid,
  })
}
