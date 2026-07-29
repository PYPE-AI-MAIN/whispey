import { mintServiceToken } from '@/lib/serviceToken';
// src/api/knowledge/documents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDeploymentTargetFromAgentBackendName } from '@/lib/getProjectRoleForApi'
import { requireApiBaseUrl } from '@/lib/pypeApiFetch'

/**
 * Delete a RAG knowledge base document.
 * Backend contract: DELETE {base}/knowledge/documents/:id
 */
const LOG_PREFIX = '[Knowledge Document Delete]'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log(`${LOG_PREFIX} Step 1: Request received`)

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
    const deploymentTarget = agentId
      ? await getDeploymentTargetFromAgentBackendName(agentId.trim())
      : 'classic'
    const urlResult = requireApiBaseUrl(deploymentTarget)
    if ('errorResponse' in urlResult) return urlResult.errorResponse
    const { apiUrl: apiBaseUrl } = urlResult
    console.log(`${LOG_PREFIX} Step 3: API base URL configured -> ${apiBaseUrl}`)

    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1'
    const backendUrl = `${apiBaseUrl}/knowledge/documents/${encodeURIComponent(id.trim())}`
    console.log(`${LOG_PREFIX} Step 4: Calling backend DELETE ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: { 'x-api-key': apiKey, 'Authorization': 'Bearer ' + mintServiceToken() },
    })

    console.log(`${LOG_PREFIX} Step 5: Backend responded status=${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`${LOG_PREFIX} Step 5 FAILED: Backend error body ->`, errorText)
      if (response.status === 404 || response.status === 501) {
        return NextResponse.json(
          { error: 'Knowledge base delete not yet implemented on backend' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: errorText || 'Delete failed' },
        { status: response.status }
      )
    }

    console.log(`${LOG_PREFIX} Step 6: Success`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`${LOG_PREFIX} UNEXPECTED ERROR:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
