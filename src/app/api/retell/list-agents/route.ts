// src/app/api/retell/list-agents/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: 'Retell API key is required' }, { status: 400 })
    }

    const response = await fetch('https://api.retellai.com/list-agents', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let message = `Retell API error: ${response.status}`
      if (response.status === 401) message = 'Invalid Retell API key'
      else { try { message = JSON.parse(errorText).message || message } catch {} }
      return NextResponse.json({ error: message }, { status: response.status })
    }

    const agents = await response.json()
    return NextResponse.json(agents)

  } catch (error) {
    console.error('Error fetching Retell agents:', error)
    return NextResponse.json({ error: 'Failed to fetch Retell agents' }, { status: 500 })
  }
}