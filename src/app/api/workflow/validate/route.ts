import { NextRequest, NextResponse } from 'next/server'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import { getPypeApiBaseUrlForServer, isPypeUpstreamUnreachable, pypeApiAbortSignal } from '@/lib/pypeApiFetch'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const baseUrl = getPypeApiBaseUrlForServer()
    if (!baseUrl) {
      return NextResponse.json({ message: 'Missing PYPEAI_API_URL or NEXT_PUBLIC_PYPEAI_API_URL' }, { status: 500 })
    }

    let response: Response
    try {
      response = await fetch(`${baseUrl}/validate_workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
        body: JSON.stringify(body),
        signal: pypeApiAbortSignal(),
      })
    } catch (err) {
      if (isPypeUpstreamUnreachable(err)) {
        return NextResponse.json({ message: 'Voice backend unreachable', unreachable: true }, { status: 503 })
      }
      throw err
    }

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (err: any) {
    return NextResponse.json({ message: 'Unexpected error validating workflow', error: err?.message }, { status: 500 })
  }
}
