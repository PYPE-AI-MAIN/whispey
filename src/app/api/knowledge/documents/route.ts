import { NextRequest, NextResponse } from 'next/server'

/**
 * List RAG knowledge base documents for an agent.
 * Backend contract: GET {base}/knowledge/documents?agent_id=xxx
 */
const LOG_PREFIX = '[Knowledge Documents List]'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')
    if (!agentId?.trim()) {
      console.error(`${LOG_PREFIX} Step 3 FAILED: agent_id missing in query`)
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      )
    }
    console.log(`${LOG_PREFIX} Step 3: agent_id present -> ${agentId.trim()}`)

    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1'
    const backendUrl = `${apiBaseUrl}/knowledge/documents?agent_id=${encodeURIComponent(agentId.trim())}`
    console.log(`${LOG_PREFIX} Step 4: Calling backend GET with agent_id=`, agentId.trim())

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: { 'x-api-key': apiKey },
    })

    console.log(`${LOG_PREFIX} Step 5: Backend responded status=${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`${LOG_PREFIX} Step 5 FAILED: Backend error body ->`, errorText)
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
    const count = Array.isArray(data?.documents) ? data.documents.length : 0
    console.log(`${LOG_PREFIX} Step 6: Success, returning documents count=${count}`, count > 0 ? `(sample ids: ${data.documents.slice(0, 3).map((d: { id?: string }) => d?.id).join(', ')})` : '')
    return NextResponse.json(data)
  } catch (error) {
    console.error(`${LOG_PREFIX} UNEXPECTED ERROR:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
