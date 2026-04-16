import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  try {
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
    const agentId = pathSegments[pathSegments.length - 2] // -2 because of "numbers" segment

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Call Pipecat API to get agent numbers
    const response = await fetch(`${pipecatBaseUrl}/agents/${agentId}/numbers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch Pipecat agent numbers' }))
      console.error('❌ Pipecat API Error:', response.status, errorData)
      return NextResponse.json(
        { error: `Pipecat API error: ${response.status} - ${JSON.stringify(errorData)}` },
        { status: response.status }
      )
    }

    const numbers = await response.json()
    console.log('✅ Fetched Pipecat agent numbers:', numbers)
    
    return NextResponse.json({
      success: true,
      data: numbers
    }, { status: 200 })

  } catch (error) {
    console.error('💥 Unexpected error fetching Pipecat agent numbers:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
