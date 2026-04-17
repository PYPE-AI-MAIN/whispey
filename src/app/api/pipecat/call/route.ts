// src/app/api/pipecat/call/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPipecatBaseUrl } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { to, agent_id, metadata } = body

    if (!to || !agent_id) {
      return NextResponse.json({ error: 'Missing required fields: to, agent_id' }, { status: 400 })
    }

    const res = await fetch(`${getPipecatBaseUrl()}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, agent_id, ...(metadata ? { metadata } : {}) }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data?.error || 'Failed to dispatch call' }, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[pipecat/call] Error:', err)
    return NextResponse.json({ error: 'Failed to connect to Pipecat server' }, { status: 502 })
  }
}