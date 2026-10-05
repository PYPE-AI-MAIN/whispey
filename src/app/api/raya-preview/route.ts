import { NextRequest, NextResponse } from 'next/server'
import {
  RAYA_LANGUAGES,
  RAYA_MODELS,
  RAYA_PREVIEW_TEXT,
  RAYA_SPEED,
  normalizeRayaLanguage,
} from '@/lib/tts/raya'

// Previews are billed per character, so cap what a client can send. The default
// sample lines are all well under this.
const MAX_PREVIEW_CHARS = 200

const baseUrl = () => (process.env.RAYA_BASE_URL || 'https://hub.getraya.app').replace(/\/+$/, '')

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.RAYA_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RAYA_API_KEY not configured', code: 'not_configured' }, { status: 503 })
    }

    const body = await request.json().catch(() => null)
    const { text, voice_id, model, language, speed } = body ?? {}

    // voice_id travels in the JSON body (never the URL), but still reject anything
    // that doesn't look like an id before it reaches a paid API.
    if (typeof voice_id !== 'string' || !/^[\w.-]{1,128}$/.test(voice_id)) {
      return NextResponse.json({ error: 'Invalid voice_id' }, { status: 400 })
    }
    if (!RAYA_MODELS.some((m) => m.value === model)) {
      return NextResponse.json({ error: 'Invalid model' }, { status: 400 })
    }
    if (!RAYA_LANGUAGES.some((l) => l.value === language)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
    }

    const lang = normalizeRayaLanguage(language)
    const line = typeof text === 'string' && text.trim() ? text.trim() : RAYA_PREVIEW_TEXT[lang]
    if (line.length > MAX_PREVIEW_CHARS) {
      return NextResponse.json({ error: `Preview text is limited to ${MAX_PREVIEW_CHARS} characters` }, { status: 400 })
    }
    const pace = Number(speed)
    const safeSpeed = Number.isFinite(pace)
      ? Math.min(RAYA_SPEED.max, Math.max(RAYA_SPEED.min, pace))
      : RAYA_SPEED.default

    const response = await fetch(`${baseUrl()}/v1/text-to-speech`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: line,
        voice_id,
        model,
        language: lang,
        codec: 'mp3',
        sample_rate: 24000,
        speed: safeSpeed,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) {
      console.error('Raya preview API error:', response.status, await response.text().catch(() => ''))
      // 404 = the voice doesn't exist for this model; say so rather than a bare 502.
      const message =
        response.status === 404
          ? 'That voice was not found for the selected model'
          : `Raya API failed: ${response.status}`
      return NextResponse.json({ error: message }, { status: 502 })
    }

    return new Response(await response.blob(), {
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg' },
    })
  } catch (error: any) {
    console.error('Raya preview error:', error)
    return NextResponse.json({ error: 'Raya preview failed' }, { status: 500 })
  }
}
