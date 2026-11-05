// app/api/campaigns/counts/route.ts
// One request for the status counts of every campaign on a page (see types/campaignScheduler.ts).
import { NextRequest, NextResponse } from 'next/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { callScheduler, relay } from '@/lib/campaignScheduler'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId') ?? ''
    const ids = searchParams.get('ids') ?? ''
    if (!projectId || !ids) {
      return NextResponse.json({ error: 'projectId and ids are required' }, { status: 400 })
    }
    if (!(await getProjectRoleForApi(projectId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const out = await callScheduler(`projects/${encodeURIComponent(projectId)}/campaigns/counts`, { projectId, query: { ids } })
    if ('error' in out) return out.error
    return relay(out.res, 'Failed to fetch campaign counts')
  } catch (error) {
    console.error('Campaign counts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
