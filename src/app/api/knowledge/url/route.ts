// src/app/api/knowledge/url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { resolveApiBaseUrlForAgent, rejectIfViewer } from '@/lib/getProjectRoleForApi'
import { knowledgeBackendHeaders, handleKnowledgeBackendResponse, withKnowledgeErrorHandling } from '@/lib/knowledgeProxy'

/**
 * Proxy URL ingestion for RAG knowledge base.
 * Viewers get 403.
 * Backend contract: POST {base}/knowledge/url with JSON { url, agent_id }.
 */
// Scraping and embedding a URL's content can take a while on the backend;
// don't let Vercel kill this route at the default 10-15s while that's in progress.
export const maxDuration = 60

const LOG_PREFIX = '[Knowledge URL]'

export const POST = withKnowledgeErrorHandling(LOG_PREFIX, async (request: NextRequest) => {
    const body = await request.json().catch(() => ({}))
    const { url, agent_id: agentId } = body
    if (!url?.trim() || !agentId?.trim()) {
      console.error(`${LOG_PREFIX} Step 3 FAILED: url or agent_id missing -> url=${!!url?.trim()}, agent_id=${!!agentId?.trim()}`)
      return NextResponse.json(
        { error: 'url and agent_id are required' },
        { status: 400 }
      )
    }

    const viewerResponse = await rejectIfViewer(agentId.trim(), 'Forbidden: viewers cannot add URLs to knowledge base')
    if (viewerResponse) return viewerResponse

    // Knowledge base lives on whichever backend this agent was actually
    // created on.
    const urlResult = await resolveApiBaseUrlForAgent(agentId.trim())
    if ('errorResponse' in urlResult) return urlResult.errorResponse
    const { apiUrl: apiBaseUrl } = urlResult
    console.log(`${LOG_PREFIX} Step 2: API base URL configured -> ${apiBaseUrl}`)

    console.log(`${LOG_PREFIX} Step 3: url and agent_id present -> url=${url.trim()}, agent_id=${agentId.trim()}`)

    const backendUrl = `${apiBaseUrl}/knowledge/url`
    console.log(`${LOG_PREFIX} Step 4: Calling backend POST ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: knowledgeBackendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ url: url.trim(), agent_id: agentId.trim() }),
    })

    const errorResponse = await handleKnowledgeBackendResponse(
      response, LOG_PREFIX, 5, 'URL ingestion failed',
      { body: { error: 'Knowledge base URL ingestion not yet implemented on backend' }, status: 503 }
    )
    if (errorResponse) return errorResponse

    const data = await response.json().catch(() => ({}))
    console.log(`${LOG_PREFIX} Step 6: Success, returning backend response`)
    return NextResponse.json(data)
})
