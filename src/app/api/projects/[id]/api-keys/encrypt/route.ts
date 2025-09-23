// src/app/api/projects/[id]/api-keys/encrypt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { encryptWithWhispeyKey } from '@/lib/whispey-crypto'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      )
    }

    const encrypted = encryptWithWhispeyKey(text)
    
    return NextResponse.json({ encrypted })
  } catch (error) {
    console.error('Encryption error:', error)
    return NextResponse.json(
      { error: 'Failed to encrypt text' },
      { status: 500 }
    )
  }
}