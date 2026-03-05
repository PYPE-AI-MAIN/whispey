import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy URL ingestion for RAG knowledge base.
 * Backend contract: POST {base}/knowledge/url with JSON { url, agent_id }.
 */
export async function POST(request: NextRequest) {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_PYPEAI_API_URL
    if (!apiBaseUrl) {
      return NextResponse.json(
        { error: 'Knowledge base API not configured' },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { url, agent_id: agentId } = body
    if (!url?.trim() || !agentId?.trim()) {
      return NextResponse.json(
        { error: 'url and agent_id are required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1'
    const response = await fetch(`${apiBaseUrl}/knowledge/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ url: url.trim(), agent_id: agentId.trim() }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      if (response.status === 404 || response.status === 501) {
        return NextResponse.json(
          { error: 'Knowledge base URL ingestion not yet implemented on backend' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: errorText || 'URL ingestion failed' },
        { status: response.status }
      )
    }

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data)
  } catch (error) {
    console.error('Knowledge URL error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
