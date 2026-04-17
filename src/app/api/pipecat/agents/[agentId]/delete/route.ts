// src/app/api/pipecat/agents/[agentId]/delete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getPipecatBaseUrl } from '@/lib/utils'

export async function DELETE(request: NextRequest) {
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

    console.log('🗑️ Deleting Pipecat agent:', agentId)

    // Call Pipecat API to delete agent
    const response = await fetch(`${pipecatBaseUrl}/agents/${agentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete Pipecat agent' }))
      console.error('❌ Pipecat API Error:', response.status, errorData)
      return NextResponse.json(
        { error: `Pipecat API error: ${response.status} - ${JSON.stringify(errorData)}` },
        { status: response.status }
      )
    }

    console.log('✅ Pipecat agent deleted successfully:', agentId)
    
    return NextResponse.json({
      success: true,
      message: 'Pipecat agent deleted successfully'
    }, { status: 200 })

  } catch (error) {
    console.error('💥 Unexpected error deleting Pipecat agent:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
