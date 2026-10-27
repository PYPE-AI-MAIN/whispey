/**
 * Server-only: proxy for the scheduler's campaign completion webhook API.
 *
 * The scheduler owns the webhook (URL, token, send-once state on the campaign
 * record). These helpers call it with the internal service JWT and make sure
 * the signed-in user belongs to the campaign's project before anything runs.
 */
import { NextResponse } from 'next/server'
import { mintServiceToken } from '@/lib/serviceToken'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import type { CampaignWebhooks } from '@/utils/campaigns/constants'

type SchedulerResult = { status: number; data: any }

export async function schedulerWebhookFetch(path: string, init: { method: string; body?: unknown }): Promise<SchedulerResult> {
  const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
  if (!rawBase) return { status: 500, data: { error: 'Service misconfigured' } }

  // Same origin lock as /api/campaigns/list: the path is ours, never user input.
  const base = new URL(rawBase)
  const url = new URL(base.href)
  const [pathname, query] = path.split('?')
  url.pathname = `${base.pathname.replace(/\/$/, '')}${pathname}`
  url.search = query ? `?${query}` : ''
  if (url.origin !== base.origin) return { status: 400, data: { error: 'Invalid request target' } }

  const response = await fetch(url.toString(), {
    method: init.method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintServiceToken()}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({ error: `Scheduler returned ${response.status}` }))
  // API Gateway answers an unknown route with 403 and its own { message }
  // ("Missing Authentication Token", or an "Invalid key=value pair" complaint
  // about our Bearer header) — that means the webhook endpoints aren't deployed.
  if (!data?.error && typeof data?.message === 'string') {
    if (response.status === 403 && /Missing Authentication Token|Authorization header/i.test(data.message)) {
      return { status: 503, data: { error: 'Campaign webhooks are not available on the scheduler yet (not deployed).' } }
    }
    return { status: response.status, data: { error: data.message } }
  }
  return { status: response.status, data }
}

export const webhookPath = (campaignId: string, suffix = '') =>
  `/api/v1/campaigns/${encodeURIComponent(campaignId)}/webhook${suffix}`

/**
 * Loads the campaign's webhook and checks the caller may see it (any project
 * member) or change it (`write`: not a viewer). Non-members get a 404 so
 * campaign ids cannot be probed.
 */
export async function authorizeCampaignWebhook(
  campaignId: string,
  { write }: { write: boolean }
): Promise<{ webhook: CampaignWebhooks } | { error: NextResponse }> {
  const { status, data } = await schedulerWebhookFetch(webhookPath(campaignId), { method: 'GET' })
  if (status !== 200 || !data?.webhook) {
    return { error: NextResponse.json({ error: data?.error || 'Campaign not found' }, { status: status === 200 ? 502 : status }) }
  }
  const role = await getProjectRoleForApi(data.webhook.projectId)
  if (!role) return { error: NextResponse.json({ error: 'Campaign not found' }, { status: 404 }) }
  if (write && role.role === 'viewer') {
    return { error: NextResponse.json({ error: 'Viewers cannot change the campaign webhook' }, { status: 403 }) }
  }
  return { webhook: data.webhook }
}

/** Relay the scheduler's answer as-is (status code and JSON). */
export const relay = ({ status, data }: SchedulerResult) => NextResponse.json(data, { status })
