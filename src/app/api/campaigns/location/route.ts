// app/api/campaigns/location/route.ts
// Where a project's campaign contacts are stored: 'pype' (default) or 'customer'.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { campaignDataLocation, campaignDestinationName } from '@/server/data-plane'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const projectId = new URL(request.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  if (!(await getProjectRoleForApi(projectId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const location = await campaignDataLocation(projectId)
    return NextResponse.json({ location, destination: location === 'customer' ? await campaignDestinationName(projectId) : null })
  } catch {
    // A registry problem must not break the campaign pages; the note is informational.
    return NextResponse.json({ location: 'pype' })
  }
}
