// src/api/knowledge/documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getProjectIdFromAgentBackendName, resolveApiBaseUrlForAgent, isViewerForProject } from '@/lib/getProjectRoleForApi'
import { knowledgeBackendHeaders, handleKnowledgeBackendResponse, withKnowledgeErrorHandling } from '@/lib/knowledgeProxy'

/**
 * List RAG knowledge base documents for an agent.
 * Backend contract: GET {base}/knowledge/documents?agent_id=xxx
 * Viewers get 403 so frontend never receives knowledge base data.
 */
const LOG_PREFIX = '[Knowledge Documents List]'

export const GET = withKnowledgeErrorHandling(LOG_PREFIX, async (request: NextRequest) => {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')
    if (!agentId?.trim()) {
      console.error(`${LOG_PREFIX} Step 3 FAILED: agent_id missing in query`)
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      )
    }

    const projectId = await getProjectIdFromAgentBackendName(agentId.trim())
    if (projectId && (await isViewerForProject(projectId))) {
      return NextResponse.json({ error: 'Forbidden: viewers cannot access knowledge base' }, { status: 403 })
    }

    // Knowledge base lives on whichever backend this agent was actually
    // created on.
    const urlResult = await resolveApiBaseUrlForAgent(agentId.trim())
    if ('errorResponse' in urlResult) return urlResult.errorResponse
    const { apiUrl: apiBaseUrl } = urlResult
    console.log(`${LOG_PREFIX} Step 2: API base URL configured -> ${apiBaseUrl}`)

    console.log(`${LOG_PREFIX} Step 3: agent_id present -> ${agentId.trim()}`)

    const backendUrl = `${apiBaseUrl}/knowledge/documents?agent_id=${encodeURIComponent(agentId.trim())}`
    console.log(`${LOG_PREFIX} Step 4: Calling backend GET with agent_id=`, agentId.trim())

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: knowledgeBackendHeaders(),
    })

    const errorResponse = await handleKnowledgeBackendResponse(
      response, LOG_PREFIX, 5, 'Failed to list documents',
      { body: { error: 'Knowledge base not yet implemented on backend', documents: [] }, status: 200 }
    )
    if (errorResponse) return errorResponse

    const data = await response.json().catch(() => ({ documents: [] }))
    const count = Array.isArray(data?.documents) ? data.documents.length : 0
    console.log(`${LOG_PREFIX} Step 6: Success, returning documents count=${count}`, count > 0 ? `(sample ids: ${data.documents.slice(0, 3).map((d: { id?: string }) => d?.id).join(', ')})` : '')
    return NextResponse.json(data)
})
