/**
 * Insight status, and the record of what was done about it.
 *
 * `acted_version_id` is the load-bearing field: it links an insight to the
 * prompt version published in response, which is what lets a later insight say
 * whether the change actually worked. Without it this is a notification system,
 * not a loop.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guarded } from '@/server/analytics/guard'
import { resolveAgentAccess, isQaDenied, qaDb } from '@/server/qa/access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({
  status: z.enum(['open', 'acknowledged', 'actioned', 'dismissed']),
  versionId: z.string().uuid().optional(),
})

export const PATCH = guarded('qa/insight', async (req: NextRequest, ctx: { params: Promise<{ insightId: string }> }) => {
  const { insightId } = await ctx.params

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { data: insight } = await qaDb
    .from('qa_insights')
    .select('id, agent_id')
    .eq('id', insightId)
    .maybeSingle()

  if (!insight) return NextResponse.json({ error: 'Insight not found' }, { status: 404 })

  const access = await resolveAgentAccess(insight.agent_id)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  const update: Record<string, unknown> = { status: parsed.data.status }
  if (parsed.data.status === 'actioned') {
    update.acted_at = new Date().toISOString()
    if (parsed.data.versionId) update.acted_version_id = parsed.data.versionId
  }

  const { error } = await qaDb.from('qa_insights').update(update).eq('id', insightId)
  if (error) return NextResponse.json({ error: 'Could not update this insight' }, { status: 500 })

  return NextResponse.json({ ok: true })
})
