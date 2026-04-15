// src/app/api/pipecat/numbers/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const baseUrl = process.env.PIPECAT_BASE_URL
  if (!baseUrl) {
    return NextResponse.json({ error: 'PIPECAT_BASE_URL not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agent_id')

  const url = agentId
    ? `${baseUrl}/v1/numbers?agent_id=${agentId}`
    : `${baseUrl}/v1/numbers`

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data?.error || 'Failed to fetch numbers' }, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[pipecat/numbers] Error:', err)
    return NextResponse.json({ error: 'Failed to connect to Pipecat server' }, { status: 502 })
  }
}