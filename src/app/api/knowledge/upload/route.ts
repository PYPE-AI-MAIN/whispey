// src/app/api/knowledge/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getProjectIdFromAgentBackendName, isViewerForProject } from '@/lib/getProjectRoleForApi'

/**
 * Proxy upload for RAG knowledge base.
 * Viewers get 403. Forwards file to backend; backend should store in vector DB and index by agent_id.
 * Backend contract: POST {base}/knowledge/upload with FormData (file, agent_id).
 */
const LOG_PREFIX = '[Knowledge Upload]'

export async function POST(request: NextRequest) {
  try {
    console.log(`${LOG_PREFIX} Step 1: Request received`)

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

    const apiBaseUrl = process.env.NEXT_PUBLIC_PYPEAI_API_URL
    if (!apiBaseUrl) {
      console.error(`${LOG_PREFIX} Step 1 FAILED: NEXT_PUBLIC_PYPEAI_API_URL not set`)
      return NextResponse.json(
        { error: 'Knowledge base API not configured' },
        { status: 503 }
      )
    }
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

    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1'
    const backendUrl = `${apiBaseUrl}/knowledge/upload`
    console.log(`${LOG_PREFIX} Step 5: Calling backend POST ${backendUrl} with agent_id=${agentId.trim()}`)

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: backendFormData,
    })

    console.log(`${LOG_PREFIX} Step 6: Backend responded status=${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`${LOG_PREFIX} Step 6 FAILED: Backend error body ->`, errorText)
      if (response.status === 404 || response.status === 501) {
        return NextResponse.json(
          { error: 'Knowledge base upload not yet implemented on backend' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: errorText || 'Upload failed' },
        { status: response.status }
      )
    }

    const data = await response.json().catch(() => ({}))
    console.log(`${LOG_PREFIX} Step 7: Success, returning backend response`)
    return NextResponse.json(data)
  } catch (error) {
    console.error(`${LOG_PREFIX} UNEXPECTED ERROR:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
