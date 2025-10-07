// src/app/api/sip/create-trunk/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.PYPEAI_API_URL
    
    if (!apiUrl) {
      return NextResponse.json({ error: 'API configuration error' }, { status: 500 })
    }

    const body = await request.json()
    const { name, numbers, allowed_numbers } = body

    const response = await fetch(`${apiUrl}/create_sip_inbound_trunk`, {
      method: 'POST',
      headers: {
        'x-api-key': 'pype-api-v1',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        numbers: numbers || [],
        allowed_numbers: allowed_numbers || []
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Failed to create SIP trunk: ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Create trunk error:', error)
    return NextResponse.json(
      { error: 'Failed to create SIP trunk', details: error.message },
      { status: 500 }
    )
  }
}