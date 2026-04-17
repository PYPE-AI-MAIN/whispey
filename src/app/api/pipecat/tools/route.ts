// src/app/api/pipecat/tools/route.ts
import { NextResponse } from 'next/server'
import { getPipecatBaseUrl } from '@/lib/utils'

export async function GET() {
  try {
    const response = await fetch(`${getPipecatBaseUrl()}/v1/tools`, {
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