// src/app/api/pipecat/call/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const baseUrl = process.env.PIPECAT_BASE_URL
  if (!baseUrl) {
    return NextResponse.json({ error: 'PIPECAT_BASE_URL not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { to, agent_id, metadata } = body

    if (!to || !agent_id) {
      return NextResponse.json({ error: 'Missing required fields: to, agent_id' }, { status: 400 })
    }

    const res = await fetch(`${baseUrl}/call`, {
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