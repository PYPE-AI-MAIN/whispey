// app/api/campaigns/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { callScheduler, relay } from '@/lib/campaignScheduler'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId') ?? ''

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    if (!(await getProjectRoleForApi(projectId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // encodeURIComponent prevents path traversal on the projectId segment.
    const out = await callScheduler(`projects/${encodeURIComponent(projectId)}/campaigns`, {
      projectId,
      query: {
        page: searchParams.get('page') ?? '1',
        limit: searchParams.get('limit') ?? '10',
        search: searchParams.get('search'),
        agentId: searchParams.get('agentId'),
        cursor: searchParams.get('cursor'),
      },
    })
    if ('error' in out) return out.error
    return relay(out.res, 'Failed to fetch campaigns')
  } catch (error) {
    console.error('List campaigns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
