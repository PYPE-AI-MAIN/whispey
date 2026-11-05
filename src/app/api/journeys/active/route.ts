/**
 * Daily active-journeys trend behind the Journeys tab's chart — same shape of
 * route as `journeys/funnel`, just grouped by day instead of by step.
 */
import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/server/analytics/guard'
import { resolveProjectAnalyticsContext, isDenied } from '@/server/analytics/context'
import { getActiveJourneysOverTime, parseJourneyFilters } from '@/server/analytics/journeys'
import { isTimeout } from '@/server/analytics/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = guarded('journeys/active', async (req: NextRequest) => {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const campaignId = req.nextUrl.searchParams.get('campaignId')
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  if (!projectId || !campaignId || !from || !to) {
    return NextResponse.json({ error: 'projectId, campaignId, from and to are required' }, { status: 400 })
  }

  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse

  try {
    const points = await getActiveJourneysOverTime(projectId, campaignId, { from, to }, parseJourneyFilters(req.nextUrl.searchParams))
    return NextResponse.json({ points })
  } catch (err) {
    if (isTimeout(err)) return NextResponse.json({ error: 'This trend took too long to compute' }, { status: 504 })
    throw err
  }
})
