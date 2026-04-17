// src/app/api/pipecat/numbers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPipecatBaseUrl } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agent_id')
  const base = getPipecatBaseUrl()

  const url = agentId
    ? `${base}/v1/numbers?agent_id=${agentId}`
    : `${base}/v1/numbers`

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