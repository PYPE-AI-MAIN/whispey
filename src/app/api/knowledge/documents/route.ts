import { NextRequest, NextResponse } from 'next/server'

/**
 * List RAG knowledge base documents for an agent.
 * Backend contract: GET {base}/knowledge/documents?agent_id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_PYPEAI_API_URL
    if (!apiBaseUrl) {
      return NextResponse.json(
        { error: 'Knowledge base API not configured' },
        { status: 503 }
      )
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')
    if (!agentId?.trim()) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1'
    const response = await fetch(
      `${apiBaseUrl}/knowledge/documents?agent_id=${encodeURIComponent(agentId.trim())}`,
      {
        method: 'GET',
        headers: { 'x-api-key': apiKey },
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      if (response.status === 404 || response.status === 501) {
        return NextResponse.json(
          { error: 'Knowledge base not yet implemented on backend', documents: [] },
          { status: 200 }
        )
      }
      return NextResponse.json(
        { error: errorText || 'Failed to list documents' },
        { status: response.status }
      )
    }

    const data = await response.json().catch(() => ({ documents: [] }))
    return NextResponse.json(data)
  } catch (error) {
    console.error('Knowledge documents list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
