// src/app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encryptApiKey } from '@/lib/vapi-encryption'

// Create Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, agent_type, configuration, project_id, environment, platform } = body

    console.log('📥 Received agent creation request:', {
      name,
      agent_type, 
      platform,
      project_id,
      environment
    })

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      )
    }

    if (!agent_type) {
      return NextResponse.json(
        { error: 'Agent type is required' },
        { status: 400 }
      )
    }

    if (!project_id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (!platform || !['livekit', 'vapi'].includes(platform)) {
      return NextResponse.json(
        { error: 'Platform must be either "livekit" or "vapi"' },
        { status: 400 }
      )
    }

    // Additional validation for Vapi agents
    if (platform === 'vapi') {
      if (!configuration?.vapi?.apiKey || !configuration?.vapi?.assistantId || !configuration?.vapi?.projectApiKey) {
        return NextResponse.json(
          { error: 'Vapi configuration is incomplete. Required: apiKey, assistantId, projectApiKey' },
          { status: 400 }
        )
      }
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('pype_voice_projects')
      .select('id')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      console.error('Project lookup error:', projectError)
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Check if agent with same name already exists in this project  
    const { data: existingAgent, error: checkError } = await supabase
      .from('pype_voice_agents')
      .select('id, name')
      .eq('project_id', project_id)
      .eq('name', name.trim())
      .maybeSingle()

    if (checkError) {
      console.error('❌ Error checking existing agent:', checkError)
      return NextResponse.json(
        { error: 'Failed to validate agent name' },
        { status: 500 }
      )
    }

    if (existingAgent) {
      return NextResponse.json(
        { error: `Agent with name "${name.trim()}" already exists in this project. Please choose a different name.` },
        { status: 409 }
      )
    }

    // Create agent data with proper typing
    const agentData: any = {
      name: name.trim(),
      agent_type,
      configuration: configuration || {},
      project_id,
      environment: environment || 'dev',
      is_active: true
    }

    // If it's a Vapi agent, encrypt and store the API keys
    if (platform === 'vapi' && configuration?.vapi) {
      // Encrypt the API keys with project-specific encryption
      agentData.vapi_api_key_encrypted = encryptApiKey(
        configuration.vapi.apiKey, 
        project_id
      )
      agentData.vapi_project_key_encrypted = encryptApiKey(
        configuration.vapi.projectApiKey, 
        project_id
      )
      
      // Remove the plain text API keys from configuration before storing
      const cleanConfiguration = { ...configuration }
      if (cleanConfiguration.vapi) {
        delete cleanConfiguration.vapi.apiKey
        delete cleanConfiguration.vapi.projectApiKey
        agentData.configuration = cleanConfiguration
      }
      
      console.log('🔐 Vapi API keys encrypted and stored securely')
    }

    console.log('💾 Inserting agent data:', {
      ...agentData,
      vapi_api_key_encrypted: agentData.vapi_api_key_encrypted ? '[ENCRYPTED]' : undefined,
      vapi_project_key_encrypted: agentData.vapi_project_key_encrypted ? '[ENCRYPTED]' : undefined
    })

    // Insert agent into pype_voice_agents
    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .insert([agentData])
      .select('*')
      .single()

    if (agentError) {
      console.error('❌ Error creating agent:', agentError)
      return NextResponse.json(
        { error: `Failed to create agent: ${agentError.message}` },
        { status: 500 }
      )
    }

    console.log(`✅ Successfully created ${platform} agent "${agent.name}" with ID: ${agent.id}`)
    
    return NextResponse.json(agent, { status: 201 })

  } catch (error) {
    console.error('💥 Unexpected error creating agent:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const { data: agents, error } = await supabase
      .from('pype_voice_agents')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching agents:', error)
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: 500 }
      )
    }

    return NextResponse.json({ agents })

  } catch (error) {
    console.error('Unexpected error fetching agents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}