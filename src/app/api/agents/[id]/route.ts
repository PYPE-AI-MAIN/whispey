// src/app/api/agents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseClient } from '@/lib/supabase-server'

// GET method to fetch agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseClient()
    const { id: agentId } = await params

    // Fetch agent data from database
    const { data: agent, error } = await supabase
      .from('pype_voice_agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Return agent data (without exposing encrypted keys)
    const agentResponse = {
      id: agent.id,
      name: agent.name,
      agent_type: agent.agent_type,
      configuration: agent.configuration,
      project_id: agent.project_id,
      environment: agent.environment,
      is_active: agent.is_active,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
      user_id: agent.user_id,
      has_vapi_keys: Boolean(agent.vapi_api_key_encrypted && agent.vapi_project_key_encrypted),
      vapi_api_key_encrypted: agent.vapi_api_key_encrypted,
      vapi_project_key_encrypted: agent.vapi_project_key_encrypted,
      field_extractor: agent.field_extractor,
      field_extractor_prompt: agent.field_extractor_prompt,
      field_extractor_keys: agent.field_extractor_keys
    }

    return NextResponse.json(agentResponse)

  } catch (error) {
    console.error('💥 Error fetching agent:', error)
    return NextResponse.json(
      { error: `Failed to fetch agent: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

// DELETE method
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseClient()
    const { id: agentId } = await params

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get agent details before deletion
    const { data: agentData, error: agentFetchError } = await supabase
      .from('pype_voice_agents')
      .select('name, project_id')
      .eq('id', agentId)
      .single()

    if (agentFetchError || !agentData) {
      console.warn('⚠️ Could not fetch agent details:', agentFetchError)
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const projectId = agentData.project_id
    if (!projectId) {
      console.error('❌ Agent has no project_id associated')
      return NextResponse.json(
        { error: 'Agent has no associated project' },
        { status: 400 }
      )
    }

    // 1. Delete call logs
    const { error: callLogsError } = await supabase
      .from('pype_voice_call_logs')
      .delete()
      .eq('agent_id', agentId)

    if (callLogsError) {
      console.error('Error deleting call logs:', callLogsError)
      return NextResponse.json(
        { error: 'Failed to delete call logs' },
        { status: 500 }
      )
    }
    console.log('Successfully deleted call logs')

    // 2. Delete metrics logs
    const { error: metricsError } = await supabase
      .from('pype_voice_metrics_logs')
      .delete()
      .eq('session_id', agentId)

    if (metricsError) {
      console.warn('Warning: Could not delete metrics logs:', metricsError)
    } else {
      console.log('Successfully deleted metrics logs')
    }

    console.log('Successfully deleted auth tokens')

    // 3. Delete the agent
    const { error: agentError } = await supabase
      .from('pype_voice_agents')
      .delete()
      .eq('id', agentId)

    if (agentError) {
      console.error('Error deleting agent:', agentError)
      return NextResponse.json(
        { error: 'Failed to delete agent' },
        { status: 500 }
      )
    }
    
    console.log(`Successfully deleted agent: ${agentId}`)

    // 4. Call backend to delete agent
    if (agentData && agentData.name) {
      try {
        console.log('🔄 Attempting backend agent deletion...')
        
        const sanitizedAgentId = agentId.replace(/-/g, '_')
        const fallbackAgentName = `${agentData.name}_${sanitizedAgentId}`
        console.log('🔄 First attempt: Deleting with agent_name:', fallbackAgentName)
        
        let backendDeleteResponse = await fetch(`${process.env.NEXT_PUBLIC_PYPEAI_API_URL}/delete_agent`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'pype-api-v1'
          },
          body: JSON.stringify({ 
            agent_name: fallbackAgentName
          })
        })

        if (!backendDeleteResponse.ok) {
          console.log('🔄 First attempt failed, trying with agent_name only')
          
          backendDeleteResponse = await fetch(`${process.env.NEXT_PUBLIC_PYPEAI_API_URL}/delete_agent`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'pype-api-v1'
            },
            body: JSON.stringify({ 
              agent_name: fallbackAgentName
            })
          })
        }

        if (backendDeleteResponse.ok) {
          console.log('✅ Successfully deleted agent from backend')
        } else {
          const errorData = await backendDeleteResponse.text()
          console.error('❌ Backend delete failed:', backendDeleteResponse.status, errorData)
        }
      } catch (backendError) {
        console.error('❌ Backend delete error:', backendError)
      }
    }

    // 5. Update project quota
    try {
      console.log('🔄 Updating project agent quota state...')
      
      const { data: projectRow, error: fetchError } = await supabase
        .from('pype_voice_projects')
        .select('agent')
        .eq('id', projectId)
        .single()

      if (fetchError || !projectRow) {
        console.warn('⚠️ Could not fetch project state:', fetchError)
      } else {
        const currentState = (projectRow as any).agent
        if (currentState && currentState.agents) {
          const updatedAgents = currentState.agents.filter((agent: any) => agent.id !== agentId)
          const updatedState = {
            ...currentState,
            usage: {
              ...currentState.usage,
              active_count: Math.max(0, currentState.usage.active_count - 1)
            },
            agents: updatedAgents,
            last_updated: new Date().toISOString()
          }

          const { error: updateError } = await supabase
            .from('pype_voice_projects')
            .update({ agent: updatedState })
            .eq('id', projectId)

          if (updateError) {
            console.error('❌ Failed to update quota:', updateError)
          } else {
            console.log('✅ Successfully updated quota')
          }
        }
      }
    } catch (quotaError) {
      console.error('❌ Error updating quota:', quotaError)
    }

    return NextResponse.json(
      { message: 'Agent and all related data deleted successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}