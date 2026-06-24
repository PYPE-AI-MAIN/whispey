import { NextRequest, NextResponse } from 'next/server'

const SCHEDULER_API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN || process.env.SCHEDULER_API_URL || ''
const SCHEDULER_HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const response = await fetch(
      `${SCHEDULER_API_URL}/api/v1/agents/${id}/callback-settings`,
      { headers: SCHEDULER_HEADERS, cache: 'no-store' }
    )

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: err }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET agent callback-settings error:', error)
    return NextResponse.json({ error: 'Failed to fetch callback settings' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!SCHEDULER_API_URL) {
    console.warn('SCHEDULER_API_URL not configured — skipping callback-settings save')
    return NextResponse.json({ ok: true, skipped: true })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const response = await fetch(
      `${SCHEDULER_API_URL}/api/v1/agents/${id}/callback-settings`,
      {
        method: 'PUT',
        headers: SCHEDULER_HEADERS,
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('Scheduler PUT callback-settings error:', response.status, errText)
      return NextResponse.json(
        { error: `Scheduler returned ${response.status}`, detail: errText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT agent callback-settings error:', error)
    return NextResponse.json({ error: 'Failed to update callback settings' }, { status: 500 })
  }
}
