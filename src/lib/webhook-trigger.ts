// src/lib/webhook-trigger.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface WebhookPayload {
  call_id: string
  agent_id: string
  customer_number: string | null
  call_ended_reason: string | null
  metadata: any
  dynamic_variables: any
  call_started_at: string | null
  call_ended_at: string | null
  recording_url: string | null
  duration_seconds: number | null
  voice_recording_url: string | null
  transcription_metrics: any
  metrics: any
  created_at: string
}

export async function triggerWebhooksForCallLog(
  agentId: string,
  projectId: string | null,
  logData: WebhookPayload
): Promise<void> {
  try {
    // Fetch active webhook configs for this agent/project
    let query = supabase
      .from('pype_voice_webhook_configs')
      .select('*')
      .eq('is_active', true)
      .contains('trigger_events', ['call_log'])

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data: webhookConfigs, error } = await query

    if (error) {
      console.error('Error fetching webhook configs:', error)
      return
    }

    if (!webhookConfigs || webhookConfigs.length === 0) {
      return
    }

    // Prepare the payload according to the user's format
    const payload: WebhookPayload = {
      call_id: logData.call_id,
      agent_id: logData.agent_id,
      customer_number: logData.customer_number,
      call_ended_reason: logData.call_ended_reason,
      metadata: logData.metadata,
      dynamic_variables: logData.dynamic_variables,
      call_started_at: logData.call_started_at,
      call_ended_at: logData.call_ended_at,
      recording_url: logData.recording_url,
      duration_seconds: logData.duration_seconds,
      voice_recording_url: logData.voice_recording_url,
      transcription_metrics: logData.transcription_metrics,
      metrics: logData.metrics,
      created_at: logData.created_at
    }

    // Trigger each webhook
    const webhookPromises = webhookConfigs.map(async (config) => {
      return triggerWebhook(config, payload)
    })

    // Execute all webhooks in parallel (don't wait for them to complete)
    Promise.allSettled(webhookPromises).then((results) => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Webhook ${webhookConfigs[index].id} failed:`, result.reason)
        }
      })
    })
  } catch (error) {
    console.error('Error triggering webhooks:', error)
  }
}

async function triggerWebhook(
  config: any,
  payload: WebhookPayload
): Promise<void> {
  const { webhook_url, http_method = 'POST', headers = {}, retry_count = 3, timeout_seconds = 30 } = config

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout_seconds * 1000)

  try {
    const response = await fetch(webhook_url, {
      method: http_method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Webhook returned status ${response.status}`)
    }

    console.log(`✅ Webhook triggered successfully: ${config.id}`)
  } catch (error: any) {
    clearTimeout(timeoutId)
    
    // Retry logic
    if (retry_count > 0 && !controller.signal.aborted) {
      console.log(`Retrying webhook ${config.id} (${retry_count} retries left)`)
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second before retry
      return triggerWebhook(
        { ...config, retry_count: retry_count - 1 },
        payload
      )
    }

    throw error
  }
}

