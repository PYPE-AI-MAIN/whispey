// src/app/api/knowledge/url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getProjectIdFromAgentBackendName, resolveApiBaseUrlForAgent, isViewerForProject } from '@/lib/getProjectRoleForApi'
import { knowledgeBackendHeaders, handleKnowledgeBackendResponse } from '@/lib/knowledgeProxy'

/**
 * Proxy URL ingestion for RAG knowledge base.
 * Viewers get 403.
 * Backend contract: POST {base}/knowledge/url with JSON { url, agent_id }.
 */
const LOG_PREFIX = '[Knowledge URL]'

export async function POST(request: NextRequest) {
  try {
    console.log(`${LOG_PREFIX} Step 1: Request received`)

    const body = await request.json().catch(() => ({}))
    const { url, agent_id: agentId } = body
    if (!url?.trim() || !agentId?.trim()) {
      console.error(`${LOG_PREFIX} Step 3 FAILED: url or agent_id missing -> url=${!!url?.trim()}, agent_id=${!!agentId?.trim()}`)
      return NextResponse.json(
        { error: 'url and agent_id are required' },
        { status: 400 }
      )
    }

    const projectId = await getProjectIdFromAgentBackendName(agentId.trim())
    if (projectId && (await isViewerForProject(projectId))) {
      return NextResponse.json({ error: 'Forbidden: viewers cannot add URLs to knowledge base' }, { status: 403 })
    }

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
  } catch (error) {
    console.error(`${LOG_PREFIX} UNEXPECTED ERROR:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
