/**
 * The calls behind one bar — Confluence "Analytics Phase 1 and 2 — Build Spec"
 * §9, §10.7. Same spec, same SQL, one page at a time, so the row count under a
 * bar always equals the bar.
 */
import { NextRequest, NextResponse } from 'next/server'
import { RowsBody, fetchRowPage } from '@/server/analytics/rowsRequest'
import { resolveAnalyticsContext, isDenied } from '@/server/analytics/context'
import { isTimeout } from '@/server/analytics/db'
import { SpecError } from '@/server/analytics/buildQuery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const parsed = RowsBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const resolved = await resolveAnalyticsContext(parsed.data.agentId)
  if (isDenied(resolved)) return resolved.errorResponse

  try {
    const page = await fetchRowPage(parsed.data, resolved.ctx, resolved.agent.outcomeRanking, 'drill')
    return NextResponse.json(page)
  } catch (err) {
    if (isTimeout(err)) return NextResponse.json({ error: 'That took too long. Try a shorter date range.' }, { status: 504 })
    if (err instanceof SpecError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[analytics/drill]', err)
    return NextResponse.json({ error: 'Could not load these calls' }, { status: 500 })
  }
}
