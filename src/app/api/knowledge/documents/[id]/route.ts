// src/api/knowledge/documents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { resolveApiBaseUrlForAgent } from '@/lib/getProjectRoleForApi'
import { requireApiBaseUrl } from '@/lib/pypeApiFetch'
import { knowledgeBackendHeaders, handleKnowledgeBackendResponse, withKnowledgeErrorHandling } from '@/lib/knowledgeProxy'

/**
 * Delete a RAG knowledge base document.
 * Backend contract: DELETE {base}/knowledge/documents/:id
 */
const LOG_PREFIX = '[Knowledge Document Delete]'

export const DELETE = withKnowledgeErrorHandling<{ params: Promise<{ id: string }> }>(
  LOG_PREFIX,
  async (request, { params }) => {
    const { id } = await params
    if (!id?.trim()) {
      console.error(`${LOG_PREFIX} Step 2 FAILED: document id missing`)
      return NextResponse.json(
        { error: 'Document id is required' },
        { status: 400 }
      )
    }
    console.log(`${LOG_PREFIX} Step 2: document id present -> ${id.trim()}`)

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')

    // Knowledge base lives on whichever backend this agent was actually
    // created on. Falls back to classic if agent_id wasn't passed (older
    // clients), matching the previous hardcoded-classic behavior.
    const urlResult = agentId
      ? await resolveApiBaseUrlForAgent(agentId.trim())
      : requireApiBaseUrl('classic')
    if ('errorResponse' in urlResult) return urlResult.errorResponse
    const { apiUrl: apiBaseUrl } = urlResult
    console.log(`${LOG_PREFIX} Step 3: API base URL configured -> ${apiBaseUrl}`)

    const backendUrl = `${apiBaseUrl}/knowledge/documents/${encodeURIComponent(id.trim())}`
    console.log(`${LOG_PREFIX} Step 4: Calling backend DELETE ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: knowledgeBackendHeaders(),
    })

    const errorResponse = await handleKnowledgeBackendResponse(
      response, LOG_PREFIX, 5, 'Delete failed',
      { body: { error: 'Knowledge base delete not yet implemented on backend' }, status: 503 }
    )
    if (errorResponse) return errorResponse

    console.log(`${LOG_PREFIX} Step 6: Success`)
    return NextResponse.json({ success: true })
  }
)
