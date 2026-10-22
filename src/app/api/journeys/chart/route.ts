/**
 * The Journeys tab's own chart builder — a campaign-scoped, dimension +
 * metric query. Kept separate from Explore's `buildQuery.ts` engine on
 * purpose (see `getCustomChart`'s own comment for why).
 */
import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/server/analytics/guard'
import { resolveProjectAnalyticsContext, isDenied } from '@/server/analytics/context'
import { getCustomChart, parseJourneyFilters, type ChartMetric } from '@/server/analytics/journeys'
import { isTimeout } from '@/server/analytics/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = guarded('journeys/chart', async (req: NextRequest) => {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const campaignId = req.nextUrl.searchParams.get('campaignId')
  const dimension = req.nextUrl.searchParams.get('dimension')
  const metric = req.nextUrl.searchParams.get('metric')
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  if (!projectId || !campaignId || !dimension || !from || !to) {
    return NextResponse.json({ error: 'projectId, campaignId, dimension, from and to are required' }, { status: 400 })
  }
  if (metric !== 'events' && metric !== 'journeys') {
    return NextResponse.json({ error: 'metric must be "events" or "journeys"' }, { status: 400 })
  }

  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse

  try {
    const points = await getCustomChart(projectId, campaignId, dimension, metric as ChartMetric, { from, to }, parseJourneyFilters(req.nextUrl.searchParams))
    return NextResponse.json({ points })
  } catch (err) {
    if (isTimeout(err)) return NextResponse.json({ error: 'This chart took too long to compute' }, { status: 504 })
    if (err instanceof Error && err.message.startsWith('Unknown chart dimension')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
})
