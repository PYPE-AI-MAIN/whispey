// src/app/api/agents/[id]/vapi/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptApiKey } from '@/lib/vapi-encryption'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    console.log('🔍 Fetching Vapi agent data for ID:', agentId)

    // Get agent data from database
    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError)
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    console.log('📊 Agent found:', {
      id: agent.id,
      name: agent.name,
      agent_type: agent.agent_type,
      hasVapiKeys: Boolean(agent.vapi_api_key_encrypted)
    })

    // Check if this is a Vapi agent with encrypted keys
    if (!agent.vapi_api_key_encrypted) {
      console.error('❌ Missing Vapi keys for agent:', agentId)
      return NextResponse.json(
        { error: 'This agent is not a Vapi agent or API key is missing' },
        { status: 400 }
      )
    }

    // Decrypt the Vapi API keys using unified utility
    let decryptedApiKey: string

    try {
      decryptedApiKey = decryptApiKey(agent.vapi_api_key_encrypted, agent.project_id)
      console.log('🔐 Successfully decrypted Vapi API key using unified method')
    } catch (decryptError) {
      console.error('❌ Failed to decrypt Vapi keys:', decryptError)
      return NextResponse.json(
        { error: 'Failed to decrypt Vapi keys' },
        { status: 500 }
      )
    }

    // Get Vapi assistant ID from configuration
    const vapiAssistantId = agent.configuration?.vapi?.assistantId

    if (!vapiAssistantId) {
      console.error('❌ Vapi assistant ID not found in configuration')
      return NextResponse.json(
        { error: 'Vapi assistant ID not found in agent configuration' },
        { status: 400 }
      )
    }

    console.log('🔑 Fetching Vapi assistant with decrypted API key:', decryptedApiKey.slice(0, 10) + '...')

    // Fetch assistant data from Vapi API using decrypted key
    const vapiResponse = await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${decryptedApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text()
      console.error('❌ Vapi API error:', {
        status: vapiResponse.status,
        statusText: vapiResponse.statusText,
        error: errorText
      })
      return NextResponse.json(
        { error: `Failed to fetch assistant from Vapi: ${vapiResponse.status} - ${errorText}` },
        { status: vapiResponse.status }
      )
    }

    const assistantData = await vapiResponse.json()
    
    console.log('✅ Successfully fetched Vapi assistant:', assistantData.name)

    // Return combined data
    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        agent_type: agent.agent_type,
        project_id: agent.project_id,
        environment: agent.environment,
        is_active: agent.is_active,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
        vapi_api_key_encrypted: agent.vapi_api_key_encrypted,
        vapi_project_key_encrypted: agent.vapi_project_key_encrypted,
        configuration: agent.configuration
      },
      vapi_assistant: assistantData,
      vapi_config: {
        assistant_id: vapiAssistantId,
        assistant_name: agent.configuration?.vapi?.assistantName,
        has_encrypted_keys: true
      }
    })

  } catch (error) {
    console.error('💥 Error fetching agent Vapi data:', error)
    return NextResponse.json(
      { error: `Failed to fetch agent data: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await request.json()
    const { action, ...actionData } = body

    console.log('📞 Making Vapi API call:', { agentId, action })

    // Get agent and decrypt keys using unified utility
    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('vapi_api_key_encrypted, vapi_project_key_encrypted, project_id, configuration')
      .eq('id', agentId)
      .single()

    if (agentError || !agent || !agent.vapi_api_key_encrypted) {
      return NextResponse.json(
        { error: 'Agent not found or not a Vapi agent' },
        { status: 404 }
      )
    }

    let decryptedApiKey: string
    try {
      decryptedApiKey = decryptApiKey(agent.vapi_api_key_encrypted, agent.project_id)
      console.log('🔐 Successfully decrypted API key for action')
    } catch (decryptError) {
      console.error('❌ Failed to decrypt API key for action:', decryptError)
      return NextResponse.json(
        { error: 'Failed to decrypt Vapi API key' },
        { status: 500 }
      )
    }

    // Handle different Vapi actions
    switch (action) {
      case 'create_call':
        console.log('🎯 Creating Vapi call with data:', actionData)
        
        // Handle both old format and new format
        const callPayload = {
          assistantId: agent.configuration?.vapi?.assistantId,
          ...actionData
        }
        
        // If it's the old working format with phoneNumberId, keep it
        if (actionData.phoneNumberId) {
          callPayload.type = 'outboundPhoneCall'
          callPayload.phoneNumberId = actionData.phoneNumberId
        }
        
        console.log('📞 Final call payload:', callPayload)
        
        // Create a call using the agent's Vapi credentials
        const callResponse = await fetch('https://api.vapi.ai/call', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(callPayload)
        })
        
        if (!callResponse.ok) {
          const errorText = await callResponse.text()
          console.error('❌ Vapi call creation failed:', errorText)
          throw new Error(`Vapi API error: ${callResponse.status} - ${errorText}`)
        }
        
        const callData = await callResponse.json()
        console.log('✅ Vapi call created successfully:', callData.id)
        
        return NextResponse.json({ success: true, call: callData, data: callData })

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('💥 Error in Vapi action:', error)
    return NextResponse.json(
      { error: `Failed to perform Vapi action: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}