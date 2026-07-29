// src/app/api/knowledge/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getProjectIdFromAgentBackendName, resolveApiBaseUrlForAgent, isViewerForProject } from '@/lib/getProjectRoleForApi'
import { knowledgeBackendHeaders, handleKnowledgeBackendResponse, withKnowledgeErrorHandling } from '@/lib/knowledgeProxy'

/**
 * Proxy upload for RAG knowledge base.
 * Viewers get 403. Forwards file to backend; backend should store in vector DB and index by agent_id.
 * Backend contract: POST {base}/knowledge/upload with FormData (file, agent_id).
 */
const LOG_PREFIX = '[Knowledge Upload]'

export const POST = withKnowledgeErrorHandling(LOG_PREFIX, async (request: NextRequest) => {
    const formData = await request.formData()
    const agentId = formData.get('agent_id') as string | null
    if (!agentId?.trim()) {
      console.error(`${LOG_PREFIX} Step 3 FAILED: agent_id missing or empty`)
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      )
    }

    const projectId = await getProjectIdFromAgentBackendName(agentId.trim())
    if (projectId && (await isViewerForProject(projectId))) {
      return NextResponse.json({ error: 'Forbidden: viewers cannot upload to knowledge base' }, { status: 403 })
    }

    // Knowledge base lives on whichever backend this agent was actually
    // created on.
    const urlResult = await resolveApiBaseUrlForAgent(agentId.trim())
    if ('errorResponse' in urlResult) return urlResult.errorResponse
    const { apiUrl: apiBaseUrl } = urlResult
    console.log(`${LOG_PREFIX} Step 2: API base URL configured -> ${apiBaseUrl}`)

    console.log(`${LOG_PREFIX} Step 3: agent_id present -> ${agentId.trim()}`)

    const backendFormData = new FormData()
    backendFormData.append('agent_id', agentId.trim())
    const file = formData.get('file') as File | null
    if (!file) {
      console.error(`${LOG_PREFIX} Step 4 FAILED: file missing in formData`)
      return NextResponse.json(
        { error: 'file is required' },
        { status: 400 }
      )
    }
    backendFormData.append('file', file)
    console.log(`${LOG_PREFIX} Step 4: file present -> name=${file.name}, size=${file.size}, type=${file.type}`)

    const backendUrl = `${apiBaseUrl}/knowledge/upload`
    console.log(`${LOG_PREFIX} Step 5: Calling backend POST ${backendUrl} with agent_id=${agentId.trim()}`)

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: knowledgeBackendHeaders(),
      body: backendFormData,
    })

    const errorResponse = await handleKnowledgeBackendResponse(
      response, LOG_PREFIX, 6, 'Upload failed',
      { body: { error: 'Knowledge base upload not yet implemented on backend' }, status: 503 }
    )
    if (errorResponse) return errorResponse

    const data = await response.json().catch(() => ({}))
    console.log(`${LOG_PREFIX} Step 7: Success, returning backend response`)
    return NextResponse.json(data)
})
