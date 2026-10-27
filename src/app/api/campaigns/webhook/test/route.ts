// app/api/campaigns/webhook/test/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { authorizeCampaignWebhook, relay, schedulerWebhookFetch } from '@/lib/campaignWebhook'

export const maxDuration = 30

// Body: { projectId, url?, token?, campaignId?, webhookId? }. Sends one sample payload
// marked test: true and reports the HTTP result. Never changes campaign state.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    if (body.campaignId) {
      const auth = await authorizeCampaignWebhook(String(body.campaignId), { write: true })
      if ('error' in auth) return auth.error
    } else {
      // Create page: no campaign yet, so check the project instead.
      const role = body.projectId ? await getProjectRoleForApi(String(body.projectId)) : null
      if (!role || role.role === 'viewer') return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    return relay(await schedulerWebhookFetch('/api/v1/campaigns/webhook/test', {
      method: 'POST',
      body: { url: body.url, token: body.token, campaignId: body.campaignId, webhookId: body.webhookId, projectId: body.projectId },
    }))
  } catch (error) {
    console.error('Test campaign webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
