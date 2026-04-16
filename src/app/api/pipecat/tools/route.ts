// src/app/api/pipecat/tools/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const pipecatBaseUrl = process.env.PIPECAT_BASE_URL
    if (!pipecatBaseUrl) {
      return NextResponse.json({ error: 'PIPECAT_BASE_URL not set' }, { status: 500 })
    }

    const response = await fetch(`${pipecatBaseUrl}/v1/tools`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch tools' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    )
  }
}