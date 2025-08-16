
// /app/api/vapi/assistants/route.ts
import { decrypt } from '@/lib/crypto'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🔍 GET /api/vapi/assistants called')
  
  try {
    const { searchParams } = new URL(request.url)
    const assistantId = searchParams.get('id')
    
    // Get authentication from request headers
    const apiKey = request.headers.get('x-vapi-api-key')
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Vapi API key required in x-vapi-api-key header' },
        { status: 401 }
      )
    }

    // Decrypt the API key
    let vapiToken: string
    try {
      vapiToken = decrypt(apiKey)
    } catch (err) {
      console.error('❌ Failed to decrypt Vapi API key:', err)
      return NextResponse.json(
        { error: 'Invalid or corrupted API key' },
        { status: 401 }
      )
    }

    if (assistantId) {
      console.log('🎯 Fetching specific assistant:', assistantId)
      const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vapiToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Vapi API error for assistant:', errorText)
        return NextResponse.json(
          { error: `Failed to fetch assistant: ${response.status}` },
          { status: response.status }
        )
      }

      const assistant = await response.json()
      console.log('✅ Successfully fetched assistant:', assistant?.id)
      return NextResponse.json({ assistant })
    } else {
      console.log('📡 Fetching all assistants...')
      const response = await fetch('https://api.vapi.ai/assistant', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vapiToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Vapi API error:', errorText)
        return NextResponse.json(
          { error: `Vapi API error: ${response.status}` },
          { status: response.status }
        )
      }

      const assistants = await response.json()
      console.log('✅ Successfully fetched assistants:', assistants?.length || 'unknown count')
      return NextResponse.json({ assistants })
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}