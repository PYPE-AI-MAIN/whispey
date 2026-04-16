// src/app/api/knowledge/search/route.ts
import { NextRequest, NextResponse } from 'next/server'

/**
 * Test search for Knowledge Base (RAG).
 * Backend contract: GET {base}/knowledge/search?agent_id=xxx&query=xxx&top_k=5
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
    const query = searchParams.get('query')
    if (!agentId?.trim()) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      )
    }
    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      )
    }

    const topK = searchParams.get('top_k')
    const params = new URLSearchParams({
      agent_id: agentId.trim(),
      query: query.trim(),
      ...(topK != null && topK !== '' && { top_k: topK }),
    })

    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1'
    const response = await fetch(
      `${apiBaseUrl}/knowledge/search?${params.toString()}`,
      {
        method: 'GET',
        headers: { 'x-api-key': apiKey },
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { error: errorText || 'Search failed' },
        { status: response.status }
      )
    }

    const data = await response.json().catch(() => ({ chunks: [], suggestions: [] }))
    return NextResponse.json(data)
  } catch (error) {
    console.error('Knowledge search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
