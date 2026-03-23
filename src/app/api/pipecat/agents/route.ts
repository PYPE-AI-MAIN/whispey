import { NextRequest, NextResponse } from 'next/server'

const PIPECAT_BASE_URL = process.env.PIPECAT_BASE_URL || 'http://13.201.89.77:7860'

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${PIPECAT_BASE_URL}/v1/agents`, {
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