import { NextRequest, NextResponse } from 'next/server'
import { getPipecatBaseUrl } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agent_name, user_name } = body

    if (!agent_name) {
      return NextResponse.json({ error: 'agent_name is required' }, { status: 400 })
    }

    const res = await fetch(`${getPipecatBaseUrl()}/start_web_session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_name, user_name: user_name || 'Web User' }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || 'Failed to start web session' },
        { status: res.status }
      )
    }

    // Returns: { room_url, token, agent_name }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[pipecat/start-web-session]', err)
    return NextResponse.json({ error: 'Failed to connect to Pipecat server' }, { status: 502 })
  }
}
