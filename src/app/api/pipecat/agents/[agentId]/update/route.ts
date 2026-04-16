import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, llm_model, tools, transfer_number, whispey_api_key, whispey_agent_id } = body

    // Get Pipecat base URL
    const pipecatBaseUrl = process.env.PIPECAT_BASE_URL
    if (!pipecatBaseUrl) {
      return NextResponse.json(
        { error: 'PIPECAT_BASE_URL environment variable is not set' },
        { status: 500 }
      )
    }

    // Get user info for authorization
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Extract agent ID from URL
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const agentId = pathSegments[pathSegments.length - 1]

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Construct update payload
    const updatePayload: any = {
      prompt: prompt || undefined,
      llm_model: llm_model || undefined,
      tools: tools || ["end_call", "transfer_call"],
      transfer_number: transfer_number || undefined,
      whispey_api_key: whispey_api_key || "pype-api-v1",
      whispey_agent_id: whispey_agent_id
    }

    // Remove undefined values
    Object.keys(updatePayload).forEach(key => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key]
      }
    })

    console.log('🔧 Updating Pipecat agent with payload:', updatePayload)

    // Call Pipecat API to update agent
    const response = await fetch(`${pipecatBaseUrl}/agents/${agentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update Pipecat agent' }))
      console.error('❌ Pipecat API Error:', response.status, errorData)
      return NextResponse.json(
        { error: `Pipecat API error: ${response.status} - ${JSON.stringify(errorData)}` },
        { status: response.status }
      )
    }

    const updatedAgent = await response.json()
    console.log('✅ Pipecat agent updated successfully:', updatedAgent)
    
    return NextResponse.json({
      success: true,
      data: updatedAgent,
      message: 'Pipecat agent updated successfully'
    }, { status: 200 })

  } catch (error) {
    console.error('💥 Unexpected error updating Pipecat agent:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
