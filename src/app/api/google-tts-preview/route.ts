import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text, voiceName, languageCode } = await request.json()

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY not configured' },
        { status: 400 }
      )
    }

    // Derive languageCode from the voice name if not provided
    // e.g. "en-US-Chirp3-HD-Achernar" → "en-US"
    const resolvedLanguageCode =
      languageCode ||
      (voiceName ? voiceName.split('-').slice(0, 2).join('-') : 'en-US')

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: text || 'Hi there! This is how I sound.' },
          voice: {
            languageCode: resolvedLanguageCode,
            name: voiceName,
          },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google TTS API error:', errorText)
      return NextResponse.json(
        { error: `Google TTS API failed: ${response.status}` },
        { status: 502 }
      )
    }

    const data = await response.json()
    const audioBuffer = Buffer.from(data.audioContent, 'base64')

    return new Response(audioBuffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (error: any) {
    console.error('Google TTS preview error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
