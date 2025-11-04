// src/app/api/agents/create-agent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase-server'

type AgentQuotaState = {
  limits: { max_agents: number }
  usage: { active_count: number }
  agents: Array<{ id: string; created_at: string; status: string }>
  last_updated: string
}

async function getOrInitProjectAgentState(projectId: string): Promise<{
  projectId: string
  state: AgentQuotaState
  error?: string
}> {
  const supabase = getSupabaseServiceClient()
  
  const { data: projectRow, error: fetchError } = await supabase
    .from('pype_voice_projects')
    .select('id, agent')
    .eq('id', projectId)
    .single()

  if (fetchError || !projectRow) {
    return { projectId: '', state: {} as AgentQuotaState, error: fetchError?.message || 'Project not found' }
  }

  const defaultState: AgentQuotaState = {
    limits: { max_agents: 2 },
    usage: { active_count: 0 },
    agents: [],
    last_updated: new Date().toISOString()
  }

  // If column exists but value is null/absent, initialize it
  let nextState: AgentQuotaState = (projectRow as any).agent || defaultState

  if (!(projectRow as any).agent) {
    const { error: initError } = await supabase
      .from('pype_voice_projects')
      .update({ agent: nextState })
      .eq('id', projectRow.id)

    if (initError) {
      return { projectId: projectRow.id, state: nextState, error: initError.message }
    }
  }

  return { projectId: projectRow.id, state: nextState }
}

// Helper function to rollback agent creation
async function rollbackAgentCreation(agentId: string, agentName?: string): Promise<void> {
  try {
    console.log('🔄 ROLLBACK: Starting rollback process')
    console.log('🔄 ROLLBACK: Agent ID:', agentId)
    console.log('🔄 ROLLBACK: Agent Name:', agentName)
    
    if (!agentName) {
      console.error('❌ ROLLBACK: No agent name provided - cannot call delete API')
      return
    }
    
    console.log('🔄 ROLLBACK: Calling backend delete API with agent_name:', agentName)
    
    // Use the internal delete-agent API endpoint that expects agent_name
    const deleteResponse = await fetch(`${process.env.NEXT_PUBLIC_PYPEAI_API_URL}/delete_agent`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'pype-api-v1'
      },
      body: JSON.stringify({ 
        agent_name: agentName
      })
    })

    console.log('🔄 ROLLBACK: Delete API response status:', deleteResponse.status)
    
    if (deleteResponse.ok) {
      console.log('✅ ROLLBACK: Successfully deleted agent from backend')
    } else {
      const errorData = await deleteResponse.text()
      console.error('❌ ROLLBACK: Failed to delete agent from backend')
      console.error('❌ ROLLBACK: Status:', deleteResponse.status)
      console.error('❌ ROLLBACK: Error:', errorData)
    }
  } catch (rollbackError) {
    console.error('❌ ROLLBACK: Error occurred during rollback:', rollbackError)
  }
}

// Helper function to rollback Supabase state
async function rollbackSupabaseState(projectId: string, originalState: AgentQuotaState): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient()
    console.log('🔄 Attempting to rollback Supabase state for project:', projectId)
    
    const { error: rollbackError } = await supabase
      .from('pype_voice_projects')
      .update({ agent: originalState }) 
      .eq('id', projectId)

    if (rollbackError) {
      console.error('❌ Failed to rollback Supabase state:', rollbackError)
    } else {
      console.log('✅ Successfully rolled back Supabase state')
    }
  } catch (rollbackError) {
    console.error('❌ Supabase rollback error:', rollbackError)
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServiceClient()
  let createdAgentId: string | null = null
  let createdAgentName: string | null = null
  let originalState: AgentQuotaState | null = null
  let dbProjectId: string | null = null
  let step1Completed = false
  let step2Completed = false
  
  try {
    console.log('🚀 Starting 3-step agent creation transaction...')
    
    const body = await request.json()
    const apiKey = request.headers.get('x-api-key')
    
    // Extract project ID from request body (preferred method)
    let projectId = body?.project_id || body?.projectId || body?.project?.id
    
    // If project ID not provided in body, try to look it up from the agent data (fallback)
    if (!projectId) {
      const agentId = body?.agent?.agent_id || body?.agent_id || body?.id || body?.agentId
      if (agentId) {
        console.log('🔍 Project ID not in request body, looking up from agent ID:', agentId)
        
        // Look up the project ID from the agent record
        const { data: agentRecord, error: agentError } = await supabase
          .from('pype_voice_agents')
          .select('project_id')
          .eq('id', agentId)
          .single()
        
        if (agentError || !agentRecord) {
          console.error('❌ Failed to look up project ID from agent:', agentError)
          return NextResponse.json(
            { error: 'Project ID is required and could not be determined from agent data' },
            { status: 400 }
          )
        }
        
        projectId = agentRecord.project_id
        console.log('✅ Found project ID from agent lookup:', projectId)
      } else {
        console.error('❌ No project ID provided in request body and no agent ID to look up')
        return NextResponse.json(
          { error: 'Project ID is required in request body' },
          { status: 400 }
        )
      }
    } else {
      console.log('✅ Using project ID from request body:', projectId)
    }
    
    // Extract agent name and ID from request body for potential rollback
    createdAgentName = body?.agent?.name || body?.name || body?.agent_name || body?.agentName || null
    createdAgentId = body?.agent?.agent_id || body?.agent_id || body?.id || body?.agentId || null

    // Validate that we have an agent ID from request body
    if (!createdAgentId) {
      console.error('❌ No agent ID provided in request body')
      return NextResponse.json(
        { error: 'Agent ID is required in request body' },
        { status: 400 }
      )
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    // Identify current user via Clerk for authorization
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Ensure agent quota state exists for the project, and check limits
    const { projectId: projectIdFromState, state, error: stateError } = await getOrInitProjectAgentState(projectId)
    dbProjectId = projectIdFromState
    if (stateError) {
      console.error('❌ Supabase project/agent state error:', stateError)
      return NextResponse.json({ error: 'Failed to load project state' }, { status: 500 })
    }

    const currentActive = state?.usage?.active_count ?? 0
    const maxAllowed = state?.limits?.max_agents ?? 0
    if (currentActive >= maxAllowed) {
      return NextResponse.json(
        { error: 'Agent limit reached. Please upgrade your plan or deactivate an agent.' },
        { status: 403 }
      )
    }

    // Store original state for potential rollback
    originalState = { ...state }

    // ========================================
    // STEP 1: Update Supabase - Reserve agent slot
    // ========================================
    try {
      console.log('📝 STEP 1: Updating Supabase to reserve agent slot...')
      
      const createdAt = new Date().toISOString()
      const tempAgentEntry = {
        id: createdAgentId,
        created_at: createdAt,
        status: 'active' // Agent is active as soon as it's created
      }

      const step1State: AgentQuotaState = {
        limits: { max_agents: maxAllowed },
        usage: { active_count: currentActive + 1 }, // Increment active_count for active agents
        agents: [
          ...(state?.agents || []),
          tempAgentEntry
        ],
        last_updated: createdAt
      }

      console.log('🔍 Step 1 - Updated state to save:', JSON.stringify(step1State, null, 2))

      const { error: step1Error } = await supabase
        .from('pype_voice_projects')
        .update({ agent: step1State })
        .eq('id', dbProjectId)

      if (step1Error) {
        console.error('❌ STEP 1 FAILED - Supabase update error:', step1Error)
        throw new Error(`Step 1 failed: ${step1Error.message}`)
      }

      step1Completed = true
      console.log('✅ STEP 1 COMPLETED - Agent slot reserved in Supabase')
      
    } catch (step1Error) {
      console.error('❌ STEP 1 FAILED:', step1Error)
      return NextResponse.json(
        { error: 'Failed to reserve agent slot', details: step1Error instanceof Error ? step1Error.message : 'Unknown error' },
        { status: 500 }
      )
    }

    // ========================================
    // STEP 2: Call PypeAPI - Create agent
    // ========================================
    try {
      console.log('🌐 STEP 2: Calling PypeAPI to create agent...')
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_PYPEAI_API_URL}/create-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'pype-api-v1'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ STEP 2 FAILED - PypeAI API Error:', response.status, data)
        throw new Error(`PypeAPI error: ${response.status} - ${JSON.stringify(data)}`)
      }

      // Use the agent ID from request body (already extracted earlier)
      console.log('🔍 Using agent ID from request body:', createdAgentId)
      console.log('🔍 Using agent name from request body:', createdAgentName)

      step2Completed = true
      console.log('✅ STEP 2 COMPLETED - Agent created successfully via PypeAPI')
      console.log('🔍 PypeAPI response:', JSON.stringify(data, null, 2))
      
    } catch (step2Error) {
      console.error('❌ STEP 2 FAILED:', step2Error)
      
      // Rollback Step 2: Delete PypeAPI agent
      if (createdAgentId && createdAgentName) {
        console.log('🔄 Rolling back Step 2 - Deleting PypeAPI agent...')
        await rollbackAgentCreation(createdAgentId, createdAgentName)
      }
      
      // Rollback Step 1: Revert Supabase state
      if (step1Completed && originalState) {
        console.log('🔄 Rolling back Step 1 - Reverting Supabase state...')
        await rollbackSupabaseState(dbProjectId, originalState)
      }
      
      return NextResponse.json(
        { error: 'Failed to create agent via PypeAPI', details: step2Error instanceof Error ? step2Error.message : 'Unknown error' },
        { status: 500 }
      )
    }

    // ========================================
    // STEP 3: Update Supabase - Add agent ID and mark as active
    // ========================================
    try {
      console.log('📝 STEP 3: Updating Supabase with final agent details...')
      
      const createdAt = new Date().toISOString()
      const finalAgentEntry = {
        id: createdAgentId || `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: createdAgentName,
        created_at: createdAt,
        status: 'active'
      }

      const step3State: AgentQuotaState = {
        limits: { max_agents: maxAllowed },
        usage: { active_count: currentActive + 1 },
        agents: [
          ...(state?.agents || []),
          finalAgentEntry
        ],
        last_updated: createdAt
      }

      console.log('🔍 Step 3 - Final state to save:', JSON.stringify(step3State, null, 2))

      const { error: step3Error } = await supabase
        .from('pype_voice_projects')
        .update({ agent: step3State })
        .eq('id', dbProjectId)

      if (step3Error) {
        console.error('❌ STEP 3 FAILED - Supabase update error:', step3Error)
        throw new Error(`Step 3 failed: ${step3Error.message}`)
      }

      console.log('✅ STEP 3 COMPLETED - Agent details updated in Supabase')
      console.log('🎉 ALL STEPS COMPLETED - Transaction successful!')
      
      return NextResponse.json({ success: true, agentId: createdAgentId }, { status: 200 })
      
    } catch (step3Error) {
      console.error('❌ STEP 3 FAILED:', step3Error)
      
      // Rollback Step 2: Delete PypeAPI agent
      if (step2Completed && createdAgentId) {
        console.log('🔄 Rolling back Step 2 - Deleting PypeAPI agent...')
        await rollbackAgentCreation(createdAgentId, createdAgentName || undefined)
      }
      
      // Rollback Step 1: Revert Supabase state
      if (step1Completed && originalState) {
        console.log('🔄 Rolling back Step 1 - Reverting Supabase state...')
        await rollbackSupabaseState(dbProjectId, originalState)
      }
      
      return NextResponse.json(
        { error: 'Failed to update agent details in database', details: step3Error instanceof Error ? step3Error.message : 'Unknown error' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('💥 CRITICAL ERROR - Transaction failed:', error)
    
    // Comprehensive rollback
    if (step2Completed && createdAgentId) {
      console.log('🔄 CRITICAL: Rolling back Step 2 - Deleting PypeAPI agent...')
      await rollbackAgentCreation(createdAgentId, createdAgentName || undefined)
    }
    
    if (step1Completed && originalState && dbProjectId) {
      console.log('🔄 CRITICAL: Rolling back Step 1 - Reverting Supabase state...')
      await rollbackSupabaseState(dbProjectId, originalState)
    }
    
    return NextResponse.json(
      { error: 'Critical transaction failure', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}