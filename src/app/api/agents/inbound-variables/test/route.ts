// src/app/api/agents/inbound-variables/test/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectIdFromAgentBackendName, resolveApiBaseUrlForAgent, isViewerForProject } from '@/lib/getProjectRoleForApi'
import { serviceAuthHeaders } from '@/lib/serviceToken'

/**
 * Try a customer's inbound-variables endpoint once, from the dashboard.
 *
 * This is what makes the integration self-serve: the customer's developer gets
 * to see what we received and how long it took, before a real caller does.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { agent_name, phone_number, url, auth_header, timeout_ms } = body

    if (!agent_name) {
      return NextResponse.json({ error: 'agent_name is required' }, { status: 400 })
    }
    if (!phone_number) {
      return NextResponse.json({ error: 'phone_number is required' }, { status: 400 })
    }

    const projectId = await getProjectIdFromAgentBackendName(agent_name)
    if (!projectId) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    if (await isViewerForProject(projectId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const urlResult = await resolveApiBaseUrlForAgent(agent_name)
    if ('errorResponse' in urlResult) return urlResult.errorResponse
    const { apiUrl } = urlResult

    const response = await fetch(`${apiUrl}/inbound_variables/test`, {
      method: 'POST',
      headers: {
        ...serviceAuthHeaders(),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_name, phone_number, url, auth_header, timeout_ms }),
    })

    const text = await response.text().catch(() => '')
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: text || `Backend returned ${response.status}`, variables: {} },
        { status: response.status },
      )
    }

    return NextResponse.json(text ? JSON.parse(text) : { ok: false, variables: {} })
  } catch (error) {
    console.error('inbound-variables test failed:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Test failed', variables: {} },
      { status: 500 },
    )
  }
}
