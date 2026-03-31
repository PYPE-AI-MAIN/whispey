// src/app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { encryptApiKey } from '@/lib/vapi-encryption'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

async function createPipecatAgent(agentData: any, projectId: string, whispeyAgentId: string, whispeyApiKey: string) {
  const pipecatBaseUrl = process.env.PIPECAT_BASE_URL
  if (!pipecatBaseUrl) {
    throw new Error('PIPECAT_BASE_URL environment variable is not set')
  }

  const pipecatPayload = {
    name: agentData.name,
    prompt: `You are a helpful voice assistant named ${agentData.name}. ${agentData.configuration?.description || 'Assist users with their queries in a friendly and professional manner.'}`,
    tools: ["end_call", "transfer_call"],
    custom_tools: [],
    stt_language: "en-IN",
    stt_model: "saarika:v2.5",
    tts_voice_id: null,
    tts_model: "eleven_flash_v2_5",
    llm_model: "gpt-4.1-mini",
    transfer_number: "",
    whispey_api_key: whispeyApiKey,
    whispey_agent_id: whispeyAgentId  // ✅ now correctly set
  }

  console.log('🔧 Creating Pipecat agent with payload:', pipecatPayload)

  const response = await fetch(`${pipecatBaseUrl}/v1/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pipecatPayload)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to create Pipecat agent' }))
    console.error('❌ Pipecat API Error:', response.status, errorData)
    throw new Error(`Pipecat API error: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  const pipecatAgent = await response.json()
  console.log('✅ Pipecat agent created successfully:', pipecatAgent)
  
  return pipecatAgent
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, agent_type, configuration, project_id, environment, platform } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Agent name is required' }, { status: 400 })
    }

    if (!agent_type) {
      return NextResponse.json({ error: 'Agent type is required' }, { status: 400 })
    }

    if (!project_id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (platform === 'vapi') {
      if (!configuration?.vapi?.apiKey || !configuration?.vapi?.assistantId || !configuration?.vapi?.projectApiKey) {
        return NextResponse.json(
          { error: 'Vapi configuration is incomplete. Required: apiKey, assistantId, projectApiKey' },
          { status: 400 }
        )
      }
    }

    if (platform === 'retell') {
      if (!configuration?.retell?.apiKey || !configuration?.retell?.agentId) {
        return NextResponse.json(
          { error: 'Retell configuration is incomplete. Required: apiKey, agentId' },
          { status: 400 }
        )
      }
    }

    const { data: project, error: projectError } = await supabase
      .from('pype_voice_projects')
      .select('id')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      console.error('Project lookup error:', projectError)
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    const { data: existingAgent, error: checkError } = await supabase
      .from('pype_voice_agents')
      .select('id, name')
      .eq('project_id', project_id)
      .eq('name', name.trim())
      .maybeSingle()

    if (checkError) {
      console.error('❌ Error checking existing agent:', checkError)
      return NextResponse.json({ error: 'Failed to validate agent name' }, { status: 500 })
    }

    if (existingAgent) {
      return NextResponse.json(
        { error: `Agent with name "${name.trim()}" already exists in this project. Please choose a different name.` },
        { status: 409 }
      )
    }

    const agentData: any = {
      name: name.trim(),
      agent_type,
      configuration: configuration || {},
      project_id,
      environment: environment || 'dev',
      is_active: true
    }

    if (platform === 'vapi' && configuration?.vapi) {
      agentData.vapi_api_key_encrypted = encryptApiKey(configuration.vapi.apiKey, project_id)
      agentData.vapi_project_key_encrypted = encryptApiKey(configuration.vapi.projectApiKey, project_id)
      const cleanConfiguration = { ...configuration }
      if (cleanConfiguration.vapi) {
        delete cleanConfiguration.vapi.apiKey
        delete cleanConfiguration.vapi.projectApiKey
        agentData.configuration = cleanConfiguration
      }
      console.log('🔐 Vapi API keys encrypted and stored securely')
    }

    if (platform === 'retell' && configuration?.retell) {
      agentData.retell_api_key_encrypted = encryptApiKey(configuration.retell.apiKey, project_id)
      const cleanConfiguration = {
        ...configuration,
        retell: {
          agentId:    configuration.retell.agentId,
          agentName:  configuration.retell.agentName,
          voiceId:    configuration.retell.voiceId,
          language:   configuration.retell.language,
          xPypeToken: configuration.retell.projectApiKey,
        },
      }
      agentData.configuration = cleanConfiguration
      console.log('🔐 Retell API key encrypted and stored securely')
    }

    // ✅ Step 1: Insert into Supabase first to get agent.id
    console.log('💾 Inserting agent data:', {
      ...agentData,
      vapi_api_key_encrypted: agentData.vapi_api_key_encrypted ? '[ENCRYPTED]' : undefined,
      vapi_project_key_encrypted: agentData.vapi_project_key_encrypted ? '[ENCRYPTED]' : undefined,
      retell_api_key_encrypted: agentData.retell_api_key_encrypted ? '[ENCRYPTED]' : undefined,
    })

    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .insert([agentData])
      .select('*')
      .single()

    if (agentError) {
      console.error('❌ Error creating agent:', agentError)
      return NextResponse.json({ error: `Failed to create agent: ${agentError.message}` }, { status: 500 })
    }

    // ✅ Step 2: Create Pipecat agent with real agent.id and project API key
    if (platform === 'pipecat') {
      try {
        // Fetch project API key to pass to Pipecat
        const { data: apiKeyRow, error: keyError } = await supabase
          .from('pype_voice_api_keys')
          .select('token_hash_master')
          .eq('project_id', project_id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        let whispeyApiKey = 'pype-api-v1' // fallback

        if (!keyError && apiKeyRow?.token_hash_master) {
          try {
            const { decryptWithWhispeyKey } = await import('@/lib/whispey-crypto')
            whispeyApiKey = decryptWithWhispeyKey(apiKeyRow.token_hash_master)
            console.log('✅ Decrypted project API key for Pipecat')
          } catch (decryptError) {
            console.error('❌ Failed to decrypt API key, using fallback:', decryptError)
          }
        }

        const pipecatAgent = await createPipecatAgent(agent, project_id, agent.id, whispeyApiKey)

        // ✅ Store pipecat_agent_id back into Supabase configuration
        const { error: updateError } = await supabase
          .from('pype_voice_agents')
          .update({
            configuration: {
              ...agent.configuration,
              pipecat_agent_id: pipecatAgent.id
            }
          })
          .eq('id', agent.id)

        if (updateError) {
          console.error('❌ Failed to store pipecat_agent_id in Supabase:', updateError)
          // Non-fatal — agent is created, just log it
        } else {
          console.log('✅ pipecat_agent_id stored in Supabase configuration')
          agent.configuration.pipecat_agent_id = pipecatAgent.id
        }

      } catch (pipecatError) {
        console.error('❌ Failed to create Pipecat agent, rolling back Supabase record:', pipecatError)
        
        // Rollback: delete the Supabase record since Pipecat failed
        await supabase.from('pype_voice_agents').delete().eq('id', agent.id)
        
        return NextResponse.json(
          { error: `Failed to create Pipecat agent: ${pipecatError instanceof Error ? pipecatError.message : 'Unknown error'}` },
          { status: 500 }
        )
      }
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
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const { data: agents, error } = await supabase
      .from('pype_voice_agents')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching agents:', error)
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
    }

    return NextResponse.json({ agents })

  } catch (error) {
    console.error('Unexpected error fetching agents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}