// app/api/campaigns/list/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId') ?? ''
    const page      = searchParams.get('page')      ?? '1'
    const limit     = searchParams.get('limit')     ?? '10'
    const search    = searchParams.get('search')    ?? ''

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Trusted base comes entirely from server-side env — never from user input
    const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
    if (!rawBase) {
      return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 })
    }

    // Parse the trusted base once to lock its origin
    const trustedBase = new URL(rawBase)

    // Build path by appending to the trusted base pathname (preserves /dev prefix, etc.)
    // encodeURIComponent prevents path traversal on the projectId segment.
    const basePath = trustedBase.pathname.replace(/\/$/, '')
    const url = new URL(trustedBase.href)
    url.pathname = `${basePath}/api/v1/projects/${encodeURIComponent(projectId)}/campaigns`
    url.searchParams.set('page',  page)
    url.searchParams.set('limit', limit)
    if (search) url.searchParams.set('search', search)

    // Origin lock: abort if the final host drifts from the trusted base
    if (url.origin !== trustedBase.origin) {
      return NextResponse.json({ error: 'Invalid request target' }, { status: 400 })
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to fetch campaigns' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('List campaigns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}