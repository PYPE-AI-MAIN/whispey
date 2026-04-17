import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getPipecatBaseUrl } from '@/lib/utils'

const supabase = createServiceRoleClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, prompt, tools, custom_tools, stt_language, stt_model, tts_voice_id, tts_model, llm_model, transfer_number, whispey_api_key, whispey_agent_id } = body

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      )
    }

    if (!whispey_agent_id) {
      return NextResponse.json(
        { error: 'Whispey agent ID is required' },
        { status: 400 }
      )
    }

    // Get Pipecat base URL
    const pipecatBaseUrl = getPipecatBaseUrl()

    // Identify current user via Clerk for authorization
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get project ID from whispey agent
    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('project_id')
      .eq('id', whispey_agent_id)
      .single()

    if (agentError || !agent) {
      console.error('❌ Error finding agent for project lookup:', agentError)
      return NextResponse.json(
        { error: 'Invalid whispey agent ID' },
        { status: 400 }
      )
    }

    const projectId = agent.project_id

    // Construct Pipecat payload - match backend structure exactly
    const pipecatPayload = {
      name: name.trim(),
      prompt: prompt || `You are a helpful voice assistant named ${name.trim()}. Assist users with their queries in a friendly and professional manner.`,
      tools: tools || ["end_call", "transfer_call"],
      custom_tools: custom_tools ? custom_tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        url: tool.url,
        method: tool.method || "GET",
        parameters: tool.parameters || {},
        headers: tool.headers || {}
      })) : [],
      stt_language: stt_language || "en-IN",
      stt_model: stt_model || "saarika:v2.5",
      tts_voice_id: tts_voice_id || null,
      tts_model: tts_model || "eleven_flash_v2_5",
      llm_model: llm_model || "gpt-4.1-mini",
      transfer_number: transfer_number || "",
      whispey_api_key: whispey_api_key || "pype-api-v1",
      whispey_agent_id: whispey_agent_id
    }

    console.log('🔧 Creating Pipecat agent with payload:', pipecatPayload)

    // Call Pipecat API
    const response = await fetch(`${pipecatBaseUrl}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipecatPayload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create Pipecat agent' }))
      console.error('❌ Pipecat API Error:', response.status, errorData)
      return NextResponse.json(
        { error: `Pipecat API error: ${response.status} - ${JSON.stringify(errorData)}` },
        { status: response.status }
      )
    }

    const pipecatAgent = await response.json()
    console.log('✅ Pipecat agent created successfully:', pipecatAgent)
    
    return NextResponse.json({
      success: true,
      data: pipecatAgent,
      message: 'Pipecat agent created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('💥 Unexpected error creating Pipecat agent:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const pipecatBaseUrl = getPipecatBaseUrl()

    // Get user info for authorization
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Call Pipecat API to list agents
    const response = await fetch(`${pipecatBaseUrl}/v1/agents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch Pipecat agents' }))
      console.error('❌ Pipecat API Error:', response.status, errorData)
      return NextResponse.json(
        { error: `Pipecat API error: ${response.status} - ${JSON.stringify(errorData)}` },
        { status: response.status }
      )
    }

    const agents = await response.json()
    console.log('✅ Fetched Pipecat agents:', agents)
    
    return NextResponse.json({
      success: true,
      data: agents
    }, { status: 200 })

  } catch (error) {
    console.error('💥 Unexpected error fetching Pipecat agents:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
