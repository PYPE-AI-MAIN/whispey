import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text, speaker, model } = await request.json()

    const apiKey = process.env.SARVAM_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'SARVAM_API_KEY not configured' }, { status: 400 })
    }

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-Subscription-Key': apiKey,
      },
      body: JSON.stringify({
        inputs: [text || 'Hi there! This is how I sound.'],
        speaker,
        model,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Sarvam API error:', errorText)
      return NextResponse.json(
        { error: `Sarvam API failed: ${response.status}` },
        { status: 502 }
      )
    }

    // Sarvam returns JSON: { "audios": ["<base64-encoded WAV>"], ... }
    const data = await response.json()
    const base64Audio = data?.audios?.[0]

    if (!base64Audio) {
      console.error('Sarvam response missing audios field:', JSON.stringify(data))
      return NextResponse.json({ error: 'No audio in Sarvam response' }, { status: 502 })
    }

    const audioBuffer = Buffer.from(base64Audio, 'base64')

    return new Response(audioBuffer, {
      headers: { 'Content-Type': 'audio/wav' },
    })
  } catch (error: any) {
    console.error('Sarvam preview error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
