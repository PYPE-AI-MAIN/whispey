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

    // Call Pipecat API to list agents
    const response = await fetch(`${pipecatBaseUrl}/agents`, {
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
