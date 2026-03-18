// src/app/api/agents/[id]/retell/status/route.ts
// Checks whether the Retell agent has our webhook URL configured.
// Mirrors the Vapi status route pattern.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptApiKey } from '@/lib/vapi-encryption'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const RETELL_API_BASE = 'https://api.retellai.com'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('id, agent_type, configuration, retell_api_key_encrypted, project_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.agent_type !== 'retell') {
      return NextResponse.json({ error: 'Not a Retell agent' }, { status: 400 })
    }

    const retellAgentId = agent.configuration?.retell?.agentId

    if (!agent.retell_api_key_encrypted || !retellAgentId) {
      return NextResponse.json({
        connected: false,
        status: 'missing_credentials',
        message: 'Missing Retell API key or agent ID',
      })
    }

    let retellApiKey: string
    try {
      retellApiKey = decryptApiKey(agent.retell_api_key_encrypted, agent.project_id)
    } catch {
      return NextResponse.json({
        connected: false,
        status: 'decryption_error',
        message: 'Failed to decrypt Retell API key',
      })
    }

    // Fetch agent from Retell to check webhook_url
    const retellRes = await fetch(`${RETELL_API_BASE}/get-agent/${retellAgentId}`, {
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!retellRes.ok) {
      return NextResponse.json({
        connected: false,
        status: 'api_error',
        message: `Retell API error: ${retellRes.status}`,
      })
    }

    const retellAgent = await retellRes.json()

    const expectedWebhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.whispey.xyz'}/api/retell/webhook`
    const hasWebhook = Boolean(retellAgent.webhook_url)
    const webhookBase = retellAgent.webhook_url?.split('?')[0]
    const webhookMatches = webhookBase === expectedWebhookUrl
    const hasToken = Boolean(agent.configuration?.retell?.xPypeToken)

    const isConnected = hasWebhook && webhookMatches

    return NextResponse.json({
      connected: isConnected,
      status: isConnected ? 'connected' : 'needs_setup',
      message: isConnected ? 'Webhook properly configured' : 'Webhook setup required',
      details: {
        webhook: {
          configured: hasWebhook,
          url: retellAgent.webhook_url,
          matches: webhookMatches,
          expected: expectedWebhookUrl,
        },
        token: {
          present: hasToken,
        },
        agent: {
          id: retellAgent.agent_id,
          name: retellAgent.agent_name,
        },
      },
    })

  } catch (error) {
    console.error('[RetellStatus] Error:', error)
    return NextResponse.json({
      connected: false,
      status: 'error',
      message: 'Failed to check connection status',
    }, { status: 500 })
  }
}