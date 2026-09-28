/**
 * The funnel behind one campaign — Confluence "Analytics Phase 3 and 4 —
 * Build Spec" §3.6.1 (generic over any campaign's steps) and §3.6.2 (the date
 * range scopes which journeys count, by `created_at`, not which events fall
 * in the window).
 */
import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/server/analytics/guard'
import { resolveProjectAnalyticsContext, isDenied } from '@/server/analytics/context'
import { getFunnel } from '@/server/analytics/journeys'
import { isTimeout } from '@/server/analytics/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = guarded('journeys/funnel', async (req: NextRequest) => {
  const projectId = req.nextUrl.searchParams.get('projectId')
  const campaignId = req.nextUrl.searchParams.get('campaignId')
  if (!projectId || !campaignId) return NextResponse.json({ error: 'projectId and campaignId are required' }, { status: 400 })

  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  const range = from && to ? { from, to } : null

  try {
    const funnel = await getFunnel(projectId, campaignId, range)
    return NextResponse.json(funnel)
  } catch (err) {
    if (isTimeout(err)) return NextResponse.json({ error: 'This funnel took too long to compute' }, { status: 504 })
    throw err
  }
})
