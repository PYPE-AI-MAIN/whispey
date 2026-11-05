// app/api/campaigns/import-status/route.ts
// Progress and rejected rows of a campaign's contact import (see types/campaignScheduler.ts).
import { NextRequest, NextResponse } from 'next/server'
import { callScheduler, relay } from '@/lib/campaignScheduler'

export async function GET(request: NextRequest) {
  try {
    const campaignId = new URL(request.url).searchParams.get('campaignId')
    if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    const out = await callScheduler(`campaigns/${encodeURIComponent(campaignId)}/import`)
    if ('error' in out) return out.error
    return relay(out.res, 'Failed to fetch import status')
  } catch (error) {
    console.error('Import status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
