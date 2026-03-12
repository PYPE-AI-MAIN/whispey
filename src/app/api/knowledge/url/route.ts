import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy URL ingestion for RAG knowledge base.
 * Backend contract: POST {base}/knowledge/url with JSON { url, agent_id }.
 */
const LOG_PREFIX = '[Knowledge URL]'

export async function POST(request: NextRequest) {
  try {
    console.log(`${LOG_PREFIX} Step 1: Request received`)

    const apiBaseUrl = process.env.NEXT_PUBLIC_PYPEAI_API_URL
    if (!apiBaseUrl) {
      console.error(`${LOG_PREFIX} Step 1 FAILED: NEXT_PUBLIC_PYPEAI_API_URL not set`)
      return NextResponse.json(
        { error: 'Knowledge base API not configured' },
        { status: 503 }
      )
    }
    console.log(`${LOG_PREFIX} Step 2: API base URL configured -> ${apiBaseUrl}`)

    const body = await request.json().catch(() => ({}))
    const { url, agent_id: agentId } = body
    if (!url?.trim() || !agentId?.trim()) {
      console.error(`${LOG_PREFIX} Step 3 FAILED: url or agent_id missing -> url=${!!url?.trim()}, agent_id=${!!agentId?.trim()}`)
      return NextResponse.json(
        { error: 'url and agent_id are required' },
        { status: 400 }
      )
    }
    console.log(`${LOG_PREFIX} Step 3: url and agent_id present -> url=${url.trim()}, agent_id=${agentId.trim()}`)

    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1'
    const backendUrl = `${apiBaseUrl}/knowledge/url`
    console.log(`${LOG_PREFIX} Step 4: Calling backend POST ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ url: url.trim(), agent_id: agentId.trim() }),
    })

    console.log(`${LOG_PREFIX} Step 5: Backend responded status=${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`${LOG_PREFIX} Step 5 FAILED: Backend error body ->`, errorText)
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
    console.log(`${LOG_PREFIX} Step 6: Success, returning backend response`)
    return NextResponse.json(data)
  } catch (error) {
    console.error(`${LOG_PREFIX} UNEXPECTED ERROR:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
