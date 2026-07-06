// Resolves the Acefone console recording link for a call. The console URL
// needs a per-recording encrypted token that only Acefone's CDR API returns —
// it cannot be templated from the agent's acefone_token JWT.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { callId, token } = await req.json().catch(() => ({}))
  if (!callId || !token) {
    return NextResponse.json({ error: 'callId and token are required' }, { status: 400 })
  }

  const res = await fetch(
    `https://api.acefone.in/v1/call/records?call_id=${encodeURIComponent(callId)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  )
  if (!res.ok) {
    return NextResponse.json({ error: `Acefone API error: ${res.status}` }, { status: 502 })
  }

  const data = await res.json()
  const recordingUrl = data?.results?.[0]?.recording_url || null
  return NextResponse.json({ recordingUrl })
}
