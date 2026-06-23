export interface WebhookConfig {
  webhookUrl: string
  httpMethod: string
  headers: Record<string, string>
  isActive: boolean
}

export interface DropoffConfig {
  enabled: boolean
  dropoff_message: string
  delay_minutes: number
  max_retries: number
  context_dropoff_prompt: string
  call_retry_required_criteria: string
  sip_trunk_id: string | null
  phone_number_id: string | null
}

export interface CallbackConfig {
  enabled: boolean
  timeWindow: { startTime: string; endTime: string }
  allowedDays: string[]
  timezone: string
  phoneNumberId: string | null
  sipTrunkId: string | null
  maxFutureDays: number
  maxCallbacksPerContact: number
  defaultDelayMinutes: number
  minDelayMinutes: number
}

export interface SupplementalSettings {
  webhook?: WebhookConfig
  dropoff?: DropoffConfig
  callbackScheduling?: CallbackConfig
}

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function saveWebhook(agentId: string, projectId: string, cfg: WebhookConfig): Promise<void> {
  if (!cfg.isActive && !cfg.webhookUrl.trim()) {
    await fetch(`/api/webhooks/config?agent_id=${agentId}`, { method: 'DELETE' })
    return
  }

  if (cfg.webhookUrl.trim() && !isValidHttpUrl(cfg.webhookUrl)) return

  const res = await fetch('/api/webhooks/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      agent_id: agentId,
      webhook_name: 'Call Log Webhook',
      webhook_url: cfg.webhookUrl,
      http_method: cfg.httpMethod,
      headers: cfg.headers,
      trigger_events: ['call_log'],
      is_active: cfg.isActive && cfg.webhookUrl.trim() !== '',
    }),
  })
  if (!res.ok) throw new Error('Failed to save webhook configuration')
}

async function saveDropoff(agentId: string, cfg: DropoffConfig): Promise<void> {
  const res = await fetch(`/api/agents/${agentId}/dropoff-settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enabled: cfg.enabled,
      dropoff_message: cfg.dropoff_message || null,
      delay_minutes: cfg.delay_minutes,
      max_retries: cfg.max_retries,
      context_dropoff_prompt: cfg.context_dropoff_prompt || null,
      call_retry_required_criteria: cfg.call_retry_required_criteria || null,
      sip_trunk_id: cfg.sip_trunk_id || null,
      phone_number_id: cfg.phone_number_id || null,
    }),
  })
  if (!res.ok) throw new Error('Failed to save drop-off settings')
}

async function saveCallback(agentId: string, cfg: CallbackConfig): Promise<void> {
  const res = await fetch(`/api/agents/${agentId}/callback-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  })
  if (!res.ok) throw new Error('Failed to save callback settings')
}

export async function saveSupplementalSettings(
  agentId: string,
  projectId: string,
  settings: SupplementalSettings
): Promise<void> {
  const tasks: Array<{ label: string; promise: Promise<void> }> = []
  if (settings.webhook) tasks.push({ label: 'webhook', promise: saveWebhook(agentId, projectId, settings.webhook) })
  if (settings.dropoff) tasks.push({ label: 'drop-off', promise: saveDropoff(agentId, settings.dropoff) })
  if (settings.callbackScheduling) tasks.push({ label: 'callback scheduling', promise: saveCallback(agentId, settings.callbackScheduling) })

  const results = await Promise.allSettled(tasks.map((t) => t.promise))
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? tasks[i].label : null))
    .filter(Boolean) as string[]

  if (failed.length > 0) {
    throw new Error(`Failed to save: ${failed.join(', ')}`)
  }
}
