/**
 * Recent journeys for the Journeys tab's milestone list — Confluence
 * "Analytics Phase 3 and 4 — Build Spec" §3.5.3.
 */
import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/server/analytics/guard'
import { resolveProjectAnalyticsContext, isDenied } from '@/server/analytics/context'
import { getRecentJourneys } from '@/server/analytics/journeys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_LIMIT = 100

export const GET = guarded('journeys/recent', async (req: NextRequest) => {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const campaignId = req.nextUrl.searchParams.get('campaignId')
  if (!projectId || !campaignId) return NextResponse.json({ error: 'projectId and campaignId are required' }, { status: 400 })

  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse

  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? '20')
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, limitParam), MAX_LIMIT) : 20

  const journeys = await getRecentJourneys(projectId, campaignId, limit)
  return NextResponse.json({ journeys })
})
