// src/app/api/monitoring/agents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth-utils'

const MONITORING_SERVICE_BASE_URL = process.env.NEXT_PUBLIC_MONITORING_SERVICE_BASE_URL

if (!MONITORING_SERVICE_BASE_URL) {
  console.warn('⚠️ NEXT_PUBLIC_MONITORING_SERVICE_BASE_URL is not configured')
}

// GET - Fetch agent monitoring status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user (middleware already protects this route)
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!MONITORING_SERVICE_BASE_URL) {
      return NextResponse.json(
        { error: 'Monitoring service not configured' },
        { status: 500 }
      )
    }

    const { id: agentId } = await params

    // Forward request to monitoring service
    const response = await fetch(`${MONITORING_SERVICE_BASE_URL}/agents/${agentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: errorText || 'Failed to fetch agent monitoring status' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error fetching agent monitoring status:', error)
    return NextResponse.json(
      { error: `Failed to fetch agent monitoring status: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

// PATCH - Toggle monitoring on/off
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user (middleware already protects this route)
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!MONITORING_SERVICE_BASE_URL) {
      return NextResponse.json(
        { error: 'Monitoring service not configured' },
        { status: 500 }
      )
    }

    const { id: agentId } = await params
    const body = await request.json()

    // Forward request to monitoring service
    const response = await fetch(`${MONITORING_SERVICE_BASE_URL}/agents/${agentId}/monitoring`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: errorText || 'Failed to toggle monitoring' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error toggling monitoring:', error)
    return NextResponse.json(
      { error: `Failed to toggle monitoring: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

