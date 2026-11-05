// src/api/knowledge/documents/[id]/content/route.ts
import { NextResponse } from 'next/server'
import { resolveApiBaseUrlForAgent, rejectIfViewer } from '@/lib/getProjectRoleForApi'
import { knowledgeBackendHeaders, handleKnowledgeBackendResponse, withKnowledgeErrorHandlingCtx } from '@/lib/knowledgeProxy'

/**
 * The stored text of one knowledge base document, for view and download.
 * Backend contract: GET {base}/knowledge/documents/:id/content?agent_id=xxx
 * Viewers get 403, like the rest of the knowledge base.
 */
const LOG_PREFIX = '[Knowledge Document Content]'

export const GET = withKnowledgeErrorHandlingCtx<{ params: Promise<{ id: string }> }>(
  LOG_PREFIX,
  async (request, { params }) => {
    const { id } = await params
    const agentId = new URL(request.url).searchParams.get('agent_id')?.trim()
    if (!id?.trim() || !agentId) {
      return NextResponse.json({ error: 'Document id and agent_id are required' }, { status: 400 })
    }

    const viewerResponse = await rejectIfViewer(agentId, 'Forbidden: viewers cannot access knowledge base')
    if (viewerResponse) return viewerResponse

    const urlResult = await resolveApiBaseUrlForAgent(agentId)
    if ('errorResponse' in urlResult) return urlResult.errorResponse

    const response = await fetch(
      `${urlResult.apiUrl}/knowledge/documents/${encodeURIComponent(id.trim())}/content?agent_id=${encodeURIComponent(agentId)}`,
      { method: 'GET', headers: knowledgeBackendHeaders() }
    )
    const errorResponse = await handleKnowledgeBackendResponse(
      response, LOG_PREFIX, 2, 'Could not load the document',
      { body: { error: 'This document cannot be shown yet' }, status: 404 }
    )
    if (errorResponse) return errorResponse
    return NextResponse.json(await response.json())
  }
)
