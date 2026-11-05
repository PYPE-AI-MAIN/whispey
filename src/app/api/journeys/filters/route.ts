/**
 * Filter dropdown options for the Journeys tab — Confluence "Analytics Phase
 * 3 and 4 — Build Spec" §3.6.3. Real channel/status/outcome values seen for
 * this campaign, not a fixed enum — sources are free to send whatever
 * channel or outcome string makes sense to them (§3.3).
 */
import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/server/analytics/guard'
import { resolveProjectAnalyticsContext, isDenied } from '@/server/analytics/context'
import { getFilterOptions } from '@/server/analytics/journeys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = guarded('journeys/filters', async (req: NextRequest) => {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const campaignId = req.nextUrl.searchParams.get('campaignId')
  if (!projectId || !campaignId) return NextResponse.json({ error: 'projectId and campaignId are required' }, { status: 400 })

  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse

  const options = await getFilterOptions(projectId, campaignId)
  return NextResponse.json(options)
})
