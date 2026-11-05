// app/api/campaigns/[campaignId]/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authorizeCampaignWebhook, relay, schedulerWebhookFetch, webhookPath } from '@/lib/campaignWebhook'

type Params = { params: Promise<{ campaignId: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { campaignId } = await params
    const auth = await authorizeCampaignWebhook(campaignId, { write: false })
    if ('error' in auth) return auth.error
    return NextResponse.json({ success: true, webhook: auth.webhook })
  } catch (error) {
    console.error('Get campaign webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Body: { action: 'add', url, token? } | { action: 'update', id, url, token? } | { action: 'remove', id }.
// token omitted keeps the saved one (same URL only), '' clears it.
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { campaignId } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    const auth = await authorizeCampaignWebhook(campaignId, { write: true })
    if ('error' in auth) return auth.error

    return relay(await schedulerWebhookFetch(webhookPath(campaignId), {
      method: 'PUT',
      body: { action: body.action, id: body.id, url: body.url, token: body.token },
    }))
  } catch (error) {
    console.error('Save campaign webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
