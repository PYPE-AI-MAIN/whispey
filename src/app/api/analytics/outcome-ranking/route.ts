/**
 * The agent's outcome order — Confluence "Analytics Phase 1 and 2 — Build Spec"
 * §10.6. Best first, worst last; anything not on the list ranks after
 * everything on it.
 *
 * This is where we beat Metabase rather than match it. That order is currently
 * copied into eight separate queries, so changing it means editing all eight and
 * hoping none were missed. Here it is one list, read on every request, so
 * reordering it updates every chart, drill-down and export together.
 *
 * Which also means changing it changes past numbers. The editor has to say so.
 */
import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/server/analytics/guard'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { Ref } from '@/server/analytics/spec'
import { resolveAnalyticsContext, isDenied } from '@/server/analytics/context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient()

const Body = z.object({
  agentId: z.string().uuid(),
  /** Which field carries the outcome. It differs per agent, so it is stored with the order. */
  field: Ref,
  /** Best first. Duplicates are rejected: two positions for one outcome has no meaning. */
  order: z.array(z.string().min(1).max(200)).max(200),
})

export const PUT = guarded('analytics/outcome-ranking', async (req: NextRequest) => {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const { agentId, field, order } = parsed.data

  if (new Set(order).size !== order.length) {
    return NextResponse.json({ error: 'The same outcome appears twice' }, { status: 400 })
  }

  const resolved = await resolveAnalyticsContext(agentId)
  if (isDenied(resolved)) return resolved.errorResponse
  if (resolved.role === 'viewer') {
    return NextResponse.json({ error: 'Only an admin can change the outcome order' }, { status: 403 })
  }

  const { error } = await supabase
    .from('pype_voice_agents')
    .update({ outcome_ranking: { field, order, updated_at: new Date().toISOString() } })
    .eq('id', agentId)

  if (error) {
    console.error('[analytics/outcome-ranking]', error)
    return NextResponse.json({ error: 'Could not save the order' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, field, order })
})
