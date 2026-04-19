import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    // Fetch what we need for the sidebar — include configuration so we can
    // detect Pipecat agents that were created before agent_type was standardised
    const { data: agent, error } = await supabase
      .from('pype_voice_agents')
      .select('id, agent_type, configuration')
      .eq('id', agentId)
      .single()

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Normalise: agents created with agent_type='pipecat' (legacy ConnectAgentFlow bug)
    // or those that have a pipecat_agent_id stored in configuration should be treated
    // as 'pipecat_agent' so the sidebar routes knowledge base correctly.
    let agentType = agent.agent_type
    if (
      agentType === 'pipecat' ||
      (agent.configuration as any)?.pipecat_agent_id
    ) {
      agentType = 'pipecat_agent'
    }

    return NextResponse.json({
      id: agent.id,
      agent_type: agentType,
    })

  } catch (error) {
    console.error('Error fetching agent type:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agent type' },
      { status: 500 }
    )
  }
}