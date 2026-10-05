// src/app/api/pi/realtime-token/route.ts
//
// Mints a short-lived client secret for OpenAI's Realtime transcription API.
// The browser connects to OpenAI directly over WebRTC using this token — our
// server never sees the audio or the transcript, it only hands out a token
// that expires in minutes and can't be used for anything but this session.
// This is what makes true continuous streaming transcription possible on
// Vercel: the long-lived connection is browser-to-OpenAI, not through us.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export async function POST(_request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Voice transcription is not configured' }, { status: 500 })
  }

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'transcription',
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: 24000 },
              // without a language hint, the model re-detects language PER
              // UTTERANCE — heavy Hindi/English/Kannada/Bengali code-switching
              // makes that detection flip unpredictably between segments
              // (confirmed in practice: the same sentence transcribed in two
              // different scripts back to back). A fixed hint trades "wrong
              // script sometimes" for "consistently in one script" — English
              // words still come through, just rendered phonetically in it.
              transcription: { model: 'gpt-4o-transcribe', language: 'en' },
              turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 500 },
            },
          },
        },
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return NextResponse.json({ error: data?.error?.message ?? 'Failed to create realtime session' }, { status: 502 })
    return NextResponse.json({ token: data.value, expires_at: data.expires_at })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to create realtime session' }, { status: 500 })
  }
}
