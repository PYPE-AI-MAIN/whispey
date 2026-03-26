// src/app/api/retell/webhook/route.ts
// Receives Retell call_ended webhooks.
// Unlike Vapi (which embeds xPypeToken in assistant metadata),
// Retell has no agent-level metadata that flows to the webhook.
// So we look up the Whispey agent by matching call.agent_id → configuration->retell->agentId in our DB.

import { NextRequest, NextResponse } from 'next/server'
import { retellAdapter, type RetellWebhookPayload } from '@/lib/adapters/retell.adapter'
import { decryptWithWhispeyKey } from '@/lib/whispey-crypto'
import type { NormalizedCallData } from '@/lib/adapters/types'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

export async function POST(request: NextRequest) {
  try {
    const payload: RetellWebhookPayload = await request.json()

    // Only process call_ended — silently acknowledge everything else
    if (payload.event !== 'call_ended') {
      return NextResponse.json({ success: true, message: `Ignored event: ${payload.event}` })
    }

    const retellAgentId = payload.call?.agent_id
    if (!retellAgentId) {
      console.error('[RetellWebhook] Missing call.agent_id in payload')
      return NextResponse.json({ success: false, error: 'Missing agent_id' }, { status: 400 })
    }

    // Look up the Whispey agent that owns this Retell agent_id.
    // retell_agent_id is stored in configuration->retell->agentId
    const { data: allRetellAgents, error: dbError } = await supabase
      .from('pype_voice_agents')
      .select('id, project_id, retell_api_key_encrypted, configuration')
      .eq('agent_type', 'retell')

    if (dbError) {
      console.error('[RetellWebhook] DB error looking up agent:', dbError)
      return NextResponse.json({ success: false, error: 'DB error' }, { status: 500 })
    }

    const agent = allRetellAgents?.find(
      a => a.configuration?.retell?.agentId === retellAgentId
    )

    if (!agent) {
      console.warn(`[RetellWebhook] No Whispey agent found for retell agent_id: ${retellAgentId}`)
      return NextResponse.json({ success: true, message: 'Agent not registered in Whispey' })
    }

    // Decrypt the project key (xPypeToken equivalent) — stored as retell_api_key_encrypted
    // Wait — for Retell, we only store ONE key (the Retell API key for fetching agent config).
    // The xPypeToken (Whispey project key) is stored in vapi_project_key_encrypted for Vapi agents.
    // For Retell agents we need to store the Whispey project token too.
    // It lives in configuration->retell->xPypeToken (set during agent connection flow).
    const encryptedToken = agent.configuration?.retell?.xPypeToken
    if (!encryptedToken) {
    console.warn(`[RetellWebhook] Agent ${agent.id} has no xPypeToken configured — skipping send`)
    return NextResponse.json({ success: true, message: 'Agent has no Whispey token' })
    }
    const xPypeToken = agent.configuration?.retell?.xPypeToken

    if (!xPypeToken) {
      console.warn(`[RetellWebhook] Agent ${agent.id} has no xPypeToken configured — skipping send`)
      return NextResponse.json({ success: true, message: 'Agent has no Whispey token' })
    }

    // Determine environment from agent config, default to prod for webhook calls
    const environment = (process.env.NODE_ENV === 'production' ? 'prod' : 'dev') as 'dev' | 'staging' | 'prod'

    // Transform Retell payload → NormalizedCallData
    const normalized = retellAdapter.transform(payload, environment)
    if (!normalized) {
      return NextResponse.json({ success: true, message: 'Payload not eligible for processing' })
    }

    // Attach Whispey agent context to metadata
    normalized.metadata = {
      ...normalized.metadata,
      whispey_agent_id: agent.id,
      projectName: agent.configuration?.retell?.projectName || '',
    }

    // Send to Pype pipeline
    await sendToPype(normalized, xPypeToken, agent.id)

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      call_id: normalized.call_id,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[RetellWebhook] Unhandled error:', error)
    // Always return 200 to Retell to avoid retries on our processing errors
    return NextResponse.json({
      success: false,
      error: 'Processing error',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function sendToPype(data: NormalizedCallData, xPypeToken: string, whispeyAgentId: string) {
    console.log('[RetellWebhook] xPypeToken length:', xPypeToken?.length)
    console.log('[RetellWebhook] xPypeToken prefix:', xPypeToken?.slice(0, 12))


  const pypePayload = {
    call_id: data.call_id,
    customer_number: data.customer_number,
    call_started_at: data.metadata.call_started_at,
    call_ended_at: data.metadata.call_ended_at,
    agent_id: whispeyAgentId,           // Whispey agent ID, not Retell's
    recording_url: data.recording_url || '',
    transcript_with_metrics: data.transcript_with_metrics,
    call_ended_reason: data.call_ended_reason,
    environment: data.environment,
    metadata: {
      total_cost: data.metadata.total_cost,
      total_duration_seconds: data.metadata.total_duration_seconds,
      call_started_at: data.metadata.call_started_at,
      call_ended_at: data.metadata.call_ended_at,
      call_quality: 'good',
      summary: data.metadata.summary,
      projectName: data.metadata.projectName,
      retell_call_id: data.call_id,
      retell_agent_id: data.agent_id,
    },
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL_SEND_CALL_LOG_LAMBDA}/send-call-log`,
    {
      method: 'POST',
      headers: {
        'x-pype-token': xPypeToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(pypePayload),
    }
  )

  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(`[RetellWebhook] Pype API error: ${response.status} — ${responseText.substring(0, 200)}`)
  }

  console.log(`[RetellWebhook] ✅ Sent call ${data.call_id} to Pype`)
}

export async function GET() {
  return NextResponse.json({
    message: 'Retell Webhook endpoint is running',
    method: 'POST',
    path: '/api/retell/webhook',
  })
}