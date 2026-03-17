// src/app/api/agents/[id]/retell/setup-webhook/route.ts
// PATCHes the Retell agent with our webhook URL.
// Also stores xPypeToken in configuration->retell->xPypeToken so the webhook handler
// can identify which Whispey project this agent belongs to.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptApiKey } from '@/lib/vapi-encryption'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const RETELL_API_BASE = 'https://api.retellai.com'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    // 1. Get Whispey agent
    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('id, name, agent_type, configuration, retell_api_key_encrypted, project_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.agent_type !== 'retell') {
      return NextResponse.json({ error: 'Not a Retell agent' }, { status: 400 })
    }

    const retellAgentId = agent.configuration?.retell?.agentId

    console.log('Retell agent ID:', retellAgentId)

    if (!agent.retell_api_key_encrypted || !retellAgentId) {
      return NextResponse.json({
        error: 'Missing credentials',
        details: {
          hasApiKey: Boolean(agent.retell_api_key_encrypted),
          hasRetellAgentId: Boolean(retellAgentId),
        }
      }, { status: 400 })
    }

    // 2. Decrypt keys
    let retellApiKey: string
    let xPypeToken: string

    try {
      retellApiKey = decryptApiKey(agent.retell_api_key_encrypted, agent.project_id)
      // xPypeToken: for Vapi it was a separate encrypted column.
      // For Retell we reuse vapi_project_key_encrypted if the agent has it,
      // otherwise it's stored in configuration->retell->xPypeToken already.
      // Fetch fresh from DB to get project key.
      const { data: fullAgent } = await supabase
        .from('pype_voice_agents')
        .select('vapi_project_key_encrypted')
        .eq('id', agentId)
        .single()

      const { decryptWithWhispeyKey } = await import('@/lib/whispey-crypto')
      const { data: apiKeyRow } = await supabase
        .from('pype_voice_api_keys')
        .select('token_hash_master')
        .eq('project_id', agent.project_id)
        .single()

      if (apiKeyRow?.token_hash_master) {
        xPypeToken = decryptWithWhispeyKey(apiKeyRow.token_hash_master)
      } else {
        xPypeToken = ''
      }
    } catch {
      return NextResponse.json({ error: 'Failed to decrypt keys' }, { status: 500 })
    }

    if (!xPypeToken) {
      return NextResponse.json({
        error: 'No Whispey project token found. Please ensure the agent has a project key configured.'
      }, { status: 400 })
    }

    // 3. Build webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.whispey.xyz'
    const bypassToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    const webhookUrl = bypassToken
      ? `${baseUrl}/api/retell/webhook?x-vercel-protection-bypass=${bypassToken}`
      : `${baseUrl}/api/retell/webhook`
    

    // 4. PATCH Retell agent with webhook_url
    const patchRes = await fetch(`${RETELL_API_BASE}/update-agent/${retellAgentId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook_url: webhookUrl,
        webhook_events: ['call_ended'], // only what we need
      }),
    })

    if (!patchRes.ok) {
      const errorText = await patchRes.text()
      return NextResponse.json({
        error: 'Failed to configure webhook on Retell',
        details: { status: patchRes.status, response: errorText },
      }, { status: 400 })
    }

    const updatedAgent = await patchRes.json()

    // 5. Store xPypeToken in configuration->retell so webhook handler can find it
    const updatedConfig = {
      ...agent.configuration,
      retell: {
        ...agent.configuration?.retell,
        agentId: retellAgentId,
        xPypeToken,                         // stored here, never exposed in client
        webhookConfigured: true,
        webhookUrl,
      },
    }

    await supabase
      .from('pype_voice_agents')
      .update({ configuration: updatedConfig })
      .eq('id', agentId)

    console.log(`[RetellSetupWebhook] ✅ Webhook configured for agent ${agentId}`)

    return NextResponse.json({
      success: true,
      message: 'Webhook configured successfully',
      webhook: {
        url: webhookUrl,
        configured: true,
        events: ['call_ended'],
      },
      agent: {
        id: updatedAgent.agent_id,
        name: updatedAgent.agent_name,
        webhookUrl: updatedAgent.webhook_url,
      },
    })

  } catch (error) {
    console.error('[RetellSetupWebhook] Error:', error)
    return NextResponse.json({
      error: 'Failed to setup webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}