// app/api/agents/start-session/route.ts
import { NextRequest, NextResponse } from 'next/server'

interface StartSessionRequest {
  user_identity: string
  user_name: string
  agent_name: string
}

interface StartSessionResponse {
  room: string
  user_token: string
  agent_name: string
  dispatch_cli_output: string
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: StartSessionRequest = await request.json()

    // Validate required fields
    if (!body.agent_name || !body.agent_name.trim()) {
      return NextResponse.json(
        { error: 'agent_name is required' },
        { status: 400 }
      )
    }

    if (!body.user_identity || !body.user_identity.trim()) {
      return NextResponse.json(
        { error: 'user_identity is required' },
        { status: 400 }
      )
    }

    // Get API base URL from environment
    const apiBaseUrl = process.env.NEXT_PUBLIC_PYPEAI_API_URL
    if (!apiBaseUrl) {
      console.error('NEXT_PUBLIC_PYPEAI_API_URL is not configured')
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      )
    }

    // Call your backend API
    const response = await fetch(`${apiBaseUrl}/start_web_session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'pype-api-v1'
      },
      body: JSON.stringify({
        user_identity: body.user_identity,
        user_name: body.user_name,
        agent_name: body.agent_name
      })
    })

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Backend API error: ${response.status} - ${errorText}`)
      
      return NextResponse.json(
        { 
          error: 'Failed to start web session',
          details: errorText
        },
        { status: response.status }
      )
    }

    // Parse and transform the response
    const apiData: StartSessionResponse = await response.json()

    // Transform to include LiveKit URL and backward compatibility fields
    const transformedResponse = {
      room: apiData.room,
      user_token: apiData.user_token,
      agent_name: apiData.agent_name,
      dispatch_cli_output: apiData.dispatch_cli_output,
      
      // Backward compatibility
      room_name: apiData.room,
      token: apiData.user_token,
      participant_identity: body.user_identity,
      
      // Add LiveKit server URL
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL || 
           `ws://${apiBaseUrl.split('://')[1]?.split('/')[0]?.replace(':8000', ':7880')}` ||
           'ws://15.206.157.27:7880'
    }

    return NextResponse.json(transformedResponse)

  } catch (error) {
    console.error('Error in start-session API route:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
