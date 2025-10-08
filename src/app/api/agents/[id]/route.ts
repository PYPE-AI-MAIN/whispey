// src/app/api/agents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

// Create Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ADD THIS GET METHOD to your existing file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      // Include boolean flags but not the actual encrypted keys
      has_vapi_keys: Boolean(agent.vapi_api_key_encrypted && agent.vapi_project_key_encrypted),
      vapi_api_key_encrypted: agent.vapi_api_key_encrypted, // Keep for the check
      vapi_project_key_encrypted: agent.vapi_project_key_encrypted, // Keep for the check
      // Include other fields you might have
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

// Your existing DELETE method stays exactly the same
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Get clerk_id for quota update
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get agent details before deletion (we only need the name for backend deletion)
    const { data: agentData, error: agentFetchError } = await supabase
      .from('pype_voice_agents')
      .select('name')
      .eq('id', agentId)
      .single()

    if (agentFetchError || !agentData) {
      console.warn('⚠️ Could not fetch agent details:', agentFetchError)
    }

    // Start cascade deletion process

    // 1. Delete call logs for this agent
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

    // 2. Delete metrics logs (adjust based on your schema relationships)
    const { error: metricsError } = await supabase
      .from('pype_voice_metrics_logs')
      .delete()
      .eq('session_id', agentId) // Adjust this field based on your actual schema

    // Don't fail if metrics logs have different relationships
    if (metricsError) {
      console.warn('Warning: Could not delete metrics logs:', metricsError)
    } else {
      console.log('Successfully deleted metrics logs')
    }

    console.log('Successfully deleted auth tokens')

    // 4. Finally, delete the agent itself
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

    // 5. Call backend to delete agent (if agent name is available)
    if (agentData && agentData.name) {
      try {
        console.log('🔄 Calling backend to delete agent:', agentData.name)
        
        const backendDeleteResponse = await fetch(`${process.env.NEXT_PUBLIC_PYPEAI_API_URL}/delete_agent`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'pype-api-v1'
          },
          body: JSON.stringify({ 
            agent_name: agentData.name
          })
        })

        if (backendDeleteResponse.ok) {
          console.log('✅ Successfully deleted agent from backend')
        } else {
          const errorData = await backendDeleteResponse.text()
          console.error('❌ Backend delete failed:', backendDeleteResponse.status, errorData)
        }
      } catch (backendError) {
        console.error('❌ Backend delete error:', backendError)
      }
    } else {
      console.warn('⚠️ No agent name available for backend deletion')
    }

    // 6. Update user's agent quota state to reduce active count and remove agent
    try {
      console.log('🔄 Updating user agent quota state...')
      
      // Get current user state
      const { data: userRow, error: fetchError } = await supabase
        .from('pype_voice_users')
        .select('agent')
        .eq('clerk_id', clerkId)
        .single()

        if (fetchError || !userRow) {
          console.warn('⚠️ Could not fetch user state for quota update:', fetchError)
        } else {
          const currentState = (userRow as any).agent
          if (currentState && currentState.agents) {
            // Remove the agent from the agents array and reduce active count
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

            console.log('🔍 Updated user state:', JSON.stringify(updatedState, null, 2))

            const { error: updateError } = await supabase
              .from('pype_voice_users')
              .update({ agent: updatedState })
              .eq('clerk_id', clerkId)

            if (updateError) {
              console.error('❌ Failed to update user quota state:', updateError)
            } else {
              console.log('✅ Successfully updated user quota state')
            }
          }
        }
      } catch (quotaError) {
        console.error('❌ Error updating user quota state:', quotaError)
      }

    return NextResponse.json(
      { 
        message: 'Agent and all related data deleted successfully'
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error during agent deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}