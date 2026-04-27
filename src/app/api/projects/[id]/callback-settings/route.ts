import { NextRequest, NextResponse } from 'next/server'

const SCHEDULER_API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN || process.env.SCHEDULER_API_URL || ''

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const response = await fetch(
      `${SCHEDULER_API_URL}/api/v1/projects/${id}/callback-settings`,
      { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }
    )

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: err }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET callback-settings error:', error)
    return NextResponse.json({ error: 'Failed to fetch callback settings' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const response = await fetch(
      `${SCHEDULER_API_URL}/api/v1/projects/${id}/callback-settings`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: err }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT callback-settings error:', error)
    return NextResponse.json({ error: 'Failed to update callback settings' }, { status: 500 })
  }
}
