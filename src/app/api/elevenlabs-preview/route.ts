// src/app/api/elevenlabs-preview/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text, voice_id } = await request.json()
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVEN_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text: text || "Hi there! This is how I sound",
        model_id: "eleven_monolingual_v1"
      })
    })
    
    if (!response.ok) {
      throw new Error('ElevenLabs API failed')
    }
    
    return new Response(await response.blob(), {
      headers: { 'Content-Type': 'audio/mpeg' }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate audio' }, { status: 500 })
  }
}