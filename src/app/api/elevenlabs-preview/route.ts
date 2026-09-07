// src/app/api/elevenlabs-preview/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text, voice_id } = await request.json()

    const apiKey = process.env.ELEVEN_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ELEVEN_API_KEY not configured' }, { status: 400 })
    }

    // ElevenLabs voice IDs are alphanumeric; reject anything else to prevent
    // the value from being used to redirect this request elsewhere (SSRF).
    if (typeof voice_id !== 'string' || !/^[a-zA-Z0-9]+$/.test(voice_id)) {
      return NextResponse.json({ error: 'Invalid voice_id' }, { status: 400 })
    }

    // Use eleven_flash_v2_5 — the same model used in production agents,
    // supports all languages and is low-latency.
    // India residency by default; overridable via ELEVENLABS_BASE_URL for a box
    // whose key belongs to the global workspace (residency rejects it with 400).
    const base = process.env.ELEVENLABS_BASE_URL || 'https://api.in.residency.elevenlabs.io/v1'
    const response = await fetch(
      `${base}/text-to-speech/${voice_id}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text || 'Hi there! This is how I sound.',
          model_id: 'eleven_flash_v2_5',
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API error:', errorText)
      return NextResponse.json(
        { error: `ElevenLabs API failed: ${response.status}` },
        { status: 502 }
      )
    }

    // ElevenLabs streams raw MP3 bytes — forward directly
    return new Response(await response.blob(), {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (error: any) {
    console.error('ElevenLabs preview error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
