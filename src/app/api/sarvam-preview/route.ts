import { NextRequest, NextResponse } from "next/server"

const DEFAULT_PREVIEW_TEXT = 'Hi there! This is how I sound.'
const HINDI_PREVIEW_TEXT = 'नमस्ते! मेरी आवाज़ ऐसी सुनाई देती है।'

interface PreviewInput {
  text?: string
  speaker: string
  model?: string
  languageCode?: string
}

// v4 takes `text` + a required language code (and reads Indic text best in its own script);
// v2/v3 keep the original request shape.
function previewRequestBody({ text, speaker, model, languageCode }: PreviewInput) {
  if (!model?.startsWith('bulbul:v4')) {
    return { inputs: [text || DEFAULT_PREVIEW_TEXT], speaker, model }
  }
  const targetLanguageCode = languageCode || 'en-IN'
  const sample = targetLanguageCode === 'hi-IN' ? HINDI_PREVIEW_TEXT : DEFAULT_PREVIEW_TEXT
  return { text: text && text !== DEFAULT_PREVIEW_TEXT ? text : sample, target_language_code: targetLanguageCode, speaker, model }
}

export async function POST(request: NextRequest) {
  try {
    const { text, speaker, model, languageCode } = await request.json()

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
      body: JSON.stringify(previewRequestBody({ text, speaker, model, languageCode })),
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
