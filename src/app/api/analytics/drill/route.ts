/**
 * The calls behind one bar — Confluence "Analytics Phase 1 and 2 — Build Spec"
 * §9, §10.7. Same spec, same SQL, one page at a time, so the row count under a
 * bar always equals the bar.
 */
import { NextRequest, NextResponse } from 'next/server'
import { RowsBody, fetchRowPage } from '@/server/analytics/rowsRequest'
import { resolveAnalyticsContext, resolveProjectAnalyticsContext, isDenied } from '@/server/analytics/context'
import { guarded, specErrorResponse } from '@/server/analytics/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = guarded('analytics/drill', async (req: NextRequest) => {
  const parsed = RowsBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  if (!parsed.data.agentId && !parsed.data.projectId) {
    return NextResponse.json({ error: 'agentId or projectId is required' }, { status: 400 })
  }
  const resolved = parsed.data.projectId
    ? await resolveProjectAnalyticsContext(parsed.data.projectId, { agentIds: parsed.data.agentIds })
    : await resolveAnalyticsContext(parsed.data.agentId!)
  if (isDenied(resolved)) return resolved.errorResponse
  const outcomeRanking = 'agent' in resolved ? resolved.agent.outcomeRanking : undefined

  try {
    const page = await fetchRowPage(parsed.data, resolved.ctx, outcomeRanking, 'drill')
    return NextResponse.json(page)
  } catch (err) {
    return specErrorResponse('analytics/drill', err, 'Could not load these calls')
  }
})
