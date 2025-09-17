// src/app/api/agents/create-agent/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const apiKey = request.headers.get('x-api-key')

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    console.log('🚀 Calling PypeAI create-agent API...')

    const response = await fetch('https://api.pypeai.com/create-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ PypeAI API Error:', response.status, data)
      return NextResponse.json(data, { status: response.status })
    }

    console.log('✅ Agent created successfully')
    return NextResponse.json(data, { status: 200 })

  } catch (error) {
    console.error('💥 Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}