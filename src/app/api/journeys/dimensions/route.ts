/**
 * What the Journeys tab's own chart builder can break down by for this
 * campaign — fixed columns plus whatever `payload` keys this campaign's
 * events actually carry, since a campaign's own shape isn't known ahead of
 * time (see `getChartDimensions`).
 */
import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/server/analytics/guard'
import { resolveProjectAnalyticsContext, isDenied } from '@/server/analytics/context'
import { getChartDimensions } from '@/server/analytics/journeys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = guarded('journeys/dimensions', async (req: NextRequest) => {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const campaignId = req.nextUrl.searchParams.get('campaignId')
  if (!projectId || !campaignId) return NextResponse.json({ error: 'projectId and campaignId are required' }, { status: 400 })

  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse

  const dimensions = await getChartDimensions(projectId, campaignId)
  return NextResponse.json({ dimensions })
})
