// src/app/api/pipecat/agents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPipecatBaseUrl } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${getPipecatBaseUrl()}/v1/agents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch Pipecat agents' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Pipecat agents fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}