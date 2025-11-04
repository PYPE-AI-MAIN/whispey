// app/api/agents/status/[agentName]/route.ts
import { NextRequest, NextResponse } from 'next/server'

interface AgentStatusResponse {
  is_active: boolean
  worker_running: boolean
  worker_pid?: number
  inbound_ready?: boolean
  [key: string]: any // Allow for additional fields
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentName: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { agentName } = await params

    // Validate agent name
    if (!agentName || !agentName.trim()) {
      return NextResponse.json(
        { error: 'Agent name is required' },
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

    // Get API key from environment
    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY
    if (!apiKey) {
      console.error('NEXT_PUBLIC_X_API_KEY is not configured')
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    // Call backend API
    const url = `${apiBaseUrl}/agent_status/${encodeURIComponent(agentName)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      }
    })

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Backend API error: ${response.status} - ${errorText}`)
      
      return NextResponse.json(
        { 
          error: 'Failed to check agent status',
          details: errorText
        },
        { status: response.status }
      )
    }

    // Parse and return the response
    const data: AgentStatusResponse = await response.json()

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in agent status API route:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

