import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { enrichSnapshotForGitHub, pushPromptToGitHub } from '@/lib/github-prompts'

const supabase = createServiceRoleClient()

export async function fetchSchedulerCallbackSettings(agentId: string): Promise<any> {
  const schedulerUrl = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN || process.env.SCHEDULER_API_URL || ''
  if (!schedulerUrl) return null
  try {
    const res = await fetch(`${schedulerUrl}/api/v1/agents/${agentId}/callback-settings`, {
      headers: { 'x-api-key': process.env.NEXT_PUBLIC_X_API_KEY ?? '' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data && Object.keys(data).length > 0 ? data : null
  } catch {
    return null
  }
}

export async function pushEnrichedConfigToGitHub(
  agentId: string,
  configSnapshot: any,
  projectName: string,
  agentName: string,
  commitMessage: string,
  authorEmail: string,
): Promise<{ sha: string } | null> {
  const [webhookRes, dropoffRes] = await Promise.all([
    supabase
      .from('pype_voice_webhook_configs')
      .select('webhook_name, webhook_url, http_method, headers, trigger_events, is_active')
      .eq('agent_id', agentId),
    supabase
      .from('pype_voice_agent_dropoff_settings')
      .select('enabled, dropoff_message, delay_minutes, max_retries, context_dropoff_prompt, sip_trunk_id, phone_number_id')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .maybeSingle(),
  ])
  const callbackSettings = await fetchSchedulerCallbackSettings(agentId)
  const githubSnapshot = enrichSnapshotForGitHub(configSnapshot, webhookRes.data, dropoffRes.data, callbackSettings)
  return pushPromptToGitHub(projectName, agentName, githubSnapshot, commitMessage, authorEmail)
}
