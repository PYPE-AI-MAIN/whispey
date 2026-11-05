// app/api/campaigns/[campaignId]/webhook/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { authorizeCampaignWebhook, relay, schedulerWebhookFetch, webhookPath } from '@/lib/campaignWebhook'

// The scheduler waits up to 20s for the receiver.
export const maxDuration = 30

// Body: { id, mode: 'send' | 'force', expectClaimId?: string }. The scheduler decides
// atomically whether this may send; a second normal send of the same webhook gets 409.
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await params
    const body = await request.json().catch(() => ({}))

    const auth = await authorizeCampaignWebhook(campaignId, { write: true })
    if ('error' in auth) return auth.error

    const user = await currentUser()
    return relay(await schedulerWebhookFetch(webhookPath(campaignId, '/send'), {
      method: 'POST',
      body: {
        id: body?.id,
        mode: body?.mode === 'force' ? 'force' : 'send',
        expectClaimId: body?.expectClaimId,
        by: user?.emailAddresses?.[0]?.emailAddress ?? user?.id ?? 'dashboard',
      },
    }))
  } catch (error) {
    console.error('Send campaign webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
