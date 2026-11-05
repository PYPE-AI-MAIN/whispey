import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isPypeUpstreamUnreachable, pypeApiAbortSignal, requireApiBaseUrl } from '@/lib/pypeApiFetch'
import { serviceAuthHeaders } from '@/lib/serviceToken'

// The built-in prompt for dynamic user-away messages, read from the voice backend so the dashboard never
// keeps its own copy (one source of truth). Used by the "Edit prompt" drawer in Session Behaviour.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const base = requireApiBaseUrl('classic')
  if ('errorResponse' in base) return base.errorResponse

  try {
    const res = await fetch(`${base.apiUrl}/away_message/default_prompt`, {
      headers: serviceAuthHeaders(),
      signal: pypeApiAbortSignal(),
      cache: 'no-store',
    })
    const body = await res.json().catch(() => null)
    if (!res.ok || typeof body?.prompt !== 'string') {
      return NextResponse.json({ error: "Couldn't load the default prompt" }, { status: 502 })
    }
    return NextResponse.json({ prompt: body.prompt, max_chars: body.max_chars })
  } catch (err: unknown) {
    const error = isPypeUpstreamUnreachable(err) ? "Can't reach the voice backend" : "Couldn't load the default prompt"
    return NextResponse.json({ error }, { status: 502 })
  }
}
