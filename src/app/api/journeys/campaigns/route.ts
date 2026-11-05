/**
 * Campaign picker for the Journeys tab — Confluence "Analytics Phase 3 and 4
 * — Build Spec" §3.5.3. Campaigns are created implicitly by
 * `ingest_journey_event`, never by this app, so this is read-only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/server/analytics/guard'
import { resolveProjectAnalyticsContext, isDenied } from '@/server/analytics/context'
import { listCampaigns } from '@/server/analytics/journeys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = guarded('journeys/campaigns', async (req: NextRequest) => {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse

  const campaigns = await listCampaigns(projectId)
  return NextResponse.json({ campaigns })
})
