import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * Batch-translate strings to English using Google Cloud Translation API (REST).
 * Enable "Cloud Translation API" in GCP and create an API key restricted to that API.
 *
 * Env: GOOGLE_TRANSLATE_API_KEY
 *
 * @see https://cloud.google.com/translate/docs/reference/rest/v2/translate
 */
const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2'
const CHUNK_SIZE = 50

async function translateWithGoogle(texts: string[], apiKey: string): Promise<string[]> {
  const url = `${GOOGLE_TRANSLATE_URL}?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: texts,
      target: 'en',
      format: 'text',
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    data?: { translations?: { translatedText?: string }[] }
    error?: { message?: string }
  }
  if (!res.ok) {
    const msg = data.error?.message || res.statusText || 'Google Translate request failed'
    throw new Error(msg)
  }
  const list = data.data?.translations
  if (!Array.isArray(list) || list.length !== texts.length) {
    throw new Error('Unexpected response from translation service')
  }
  return list.map((row, i) => (typeof row?.translatedText === 'string' ? row.translatedText : texts[i]))
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Translation is not configured. Set GOOGLE_TRANSLATE_API_KEY (Google Cloud Translation API key).',
        },
        { status: 503 },
      )
    }

    const body = await request.json()
    const texts = body?.texts as unknown
    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'texts must be a non-empty array of strings' }, { status: 400 })
    }
    if (texts.length > 200) {
      return NextResponse.json({ error: 'Too many strings (max 200 per request)' }, { status: 400 })
    }

    for (const t of texts) {
      if (typeof t !== 'string') {
        return NextResponse.json({ error: 'Each item in texts must be a string' }, { status: 400 })
      }
      if (t.length > 15_000) {
        return NextResponse.json({ error: 'Each string must be at most 15000 characters' }, { status: 400 })
      }
    }

    const out: string[] = []
    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      const chunk = texts.slice(i, i + CHUNK_SIZE)
      const translated = await translateWithGoogle(chunk, apiKey)
      out.push(...translated)
    }

    return NextResponse.json({ translations: out })
  } catch (e) {
    console.error('translate/transcript:', e)
    const message = e instanceof Error ? e.message : 'Translation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
