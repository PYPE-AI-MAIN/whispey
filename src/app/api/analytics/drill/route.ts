/**
 * The calls behind one bar — Confluence "Analytics Phase 1 and 2 — Build Spec"
 * §9, §10.7. Same spec, same SQL, one page at a time, so the row count under a
 * bar always equals the bar.
 */
import { NextRequest, NextResponse } from 'next/server'
import { RowsBody, fetchRowPage } from '@/server/analytics/rowsRequest'
import { resolveScope, isDenied } from '@/server/analytics/context'
import { guarded, specErrorResponse } from '@/server/analytics/guard'
import { withDataPlane, rethrowDataPlane } from '@/server/data-plane'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = guarded('analytics/drill', withDataPlane(async (dp, req: NextRequest) => {
  const parsed = RowsBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const resolved = await resolveScope(parsed.data, { allowCustomerHeld: true })
  if (!resolved) return NextResponse.json({ error: 'agentId or projectId is required' }, { status: 400 })
  if (isDenied(resolved)) return resolved.errorResponse
  const outcomeRanking = 'agent' in resolved ? resolved.agent.outcomeRanking : undefined

  try {
    // a customer-held project reads its own database through the data plane (no fallback to Pype)
    const plane = resolved.customerHeld ? await dp.forProject(resolved.ctx.projectId) : undefined
    const page = await fetchRowPage(parsed.data, resolved.ctx, outcomeRanking, 'drill', plane)
    return NextResponse.json(page)
  } catch (err) {
    rethrowDataPlane(err)
    return specErrorResponse('analytics/drill', err, 'Could not load these calls')
  }
}))
