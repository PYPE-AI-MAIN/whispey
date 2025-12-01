// src/app/api/monitoring/agents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth-utils'

const MONITORING_SERVICE_BASE_URL = process.env.NEXT_PUBLIC_MONITORING_SERVICE_BASE_URL

if (!MONITORING_SERVICE_BASE_URL) {
  console.warn('⚠️ NEXT_PUBLIC_MONITORING_SERVICE_BASE_URL is not configured')
}

// POST - Register agent for monitoring
export async function POST(request: NextRequest) {
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

    const body = await request.json()

    // Forward request to monitoring service
    const response = await fetch(`${MONITORING_SERVICE_BASE_URL}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: errorText || 'Failed to register agent' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error registering agent for monitoring:', error)
    return NextResponse.json(
      { error: `Failed to register agent: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

