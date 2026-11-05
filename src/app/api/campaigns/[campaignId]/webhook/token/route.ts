// app/api/campaigns/[campaignId]/webhook/token/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authorizeCampaignWebhook, relay, schedulerWebhookFetch, webhookPath } from '@/lib/campaignWebhook'

// GET ?id=<webhookId> → { token }. Only for the edit dialog, and only for people
// who may edit (not viewers); the campaign page itself never receives tokens.
export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await params
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const auth = await authorizeCampaignWebhook(campaignId, { write: true })
    if ('error' in auth) return auth.error

    return relay(await schedulerWebhookFetch(`${webhookPath(campaignId, '/token')}?id=${encodeURIComponent(id)}`, { method: 'GET' }))
  } catch (error) {
    console.error('Get campaign webhook token error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
