// src/app/api/agents/[id]/retell/route.ts
// Fetches Retell agent config + LLM prompt for the RetellDashboard.
// Two API calls: GET /get-agent/{id} → then GET /get-retell-llm/{llm_id} for the prompt.

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

    // 1. Get Whispey agent from DB
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

    if (!agent.retell_api_key_encrypted || !retellAgentId) {
      return NextResponse.json({
        error: 'Missing credentials',
        details: {
          hasApiKey: Boolean(agent.retell_api_key_encrypted),
          hasRetellAgentId: Boolean(retellAgentId),
        }
      }, { status: 400 })
    }

    // 2. Decrypt Retell API key
    let retellApiKey: string
    try {
      retellApiKey = decryptApiKey(agent.retell_api_key_encrypted, agent.project_id)
    } catch {
      return NextResponse.json({ error: 'Failed to decrypt Retell API key' }, { status: 500 })
    }

    // 3. Fetch agent config from Retell
    const agentRes = await fetch(`${RETELL_API_BASE}/get-agent/${retellAgentId}`, {
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!agentRes.ok) {
      const errorText = await agentRes.text()
      if (agentRes.status === 401) {
        return NextResponse.json({ error: 'Invalid Retell API key' }, { status: 401 })
      }
      if (agentRes.status === 404) {
        return NextResponse.json({ error: 'Retell agent not found — it may have been deleted' }, { status: 404 })
      }
      return NextResponse.json({ error: `Retell API error: ${agentRes.status}` }, { status: 400 })
    }

    const retellAgent = await agentRes.json()

    // 4. Fetch LLM prompt if response_engine is retell-llm type
    let llmData: any = null
    const responseEngine = retellAgent.response_engine

    if (responseEngine?.type === 'retell-llm' && responseEngine?.llm_id) {
      const llmRes = await fetch(`${RETELL_API_BASE}/get-retell-llm/${responseEngine.llm_id}`, {
        headers: {
          'Authorization': `Bearer ${retellApiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (llmRes.ok) {
        llmData = await llmRes.json()
      } else {
        // Non-fatal — we still show agent config even if LLM fetch fails
        console.warn(`[RetellAgentAPI] Failed to fetch LLM ${responseEngine.llm_id}: ${llmRes.status}`)
      }
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        project_id: agent.project_id,
        configuration: agent.configuration,
      },
      retell_agent: retellAgent,
      retell_llm: llmData, // null if custom LLM or fetch failed
    })

  } catch (error) {
    console.error('[RetellAgentAPI] Error:', error)
    return NextResponse.json({
      error: 'Failed to fetch agent',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}