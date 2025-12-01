// src/app/api/sip/create-dispatch-rule/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user (middleware already protects this route)
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const apiUrl = process.env.PYPEAI_API_URL
    
    if (!apiUrl) {
      return NextResponse.json({ error: 'API configuration error' }, { status: 500 })
    }

    const body = await request.json()
    const { room_prefix, agent_name, metadata, trunk_ids, name } = body

    const response = await fetch(`${apiUrl}/create_sip_dispatch_rule`, {
      method: 'POST',
      headers: {
        'x-api-key': 'pype-api-v1',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        room_prefix: room_prefix || 'call-',
        agent_name,
        metadata: metadata || '',
        trunkIds: trunk_ids || [],
        name: name || ''
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Failed to create dispatch rule: ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Create dispatch rule error:', error)
    return NextResponse.json(
      { error: 'Failed to create dispatch rule', details: error.message },
      { status: 500 }
    )
  }
}