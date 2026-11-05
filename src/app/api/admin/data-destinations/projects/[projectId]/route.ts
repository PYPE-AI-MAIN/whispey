import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { requirePlatformAdmin } from '@/server/admin/requirePlatformAdmin'
import { getRegistryStore } from '@/server/data-plane/admin/registryStore'
import { countActiveCalls } from '@/server/data-plane/admin/activeCalls'
import { changeProjectRoutes, type DesiredRoute } from '@/server/data-plane/admin/routeChange'
import { DATA_TYPES, type DataType } from '@/server/data-plane/routingPolicy'
import { getDataPlaneResolver } from '@/server/data-plane/resolver'
import { DataPlaneError } from '@/server/data-plane/errors'

export const runtime = 'nodejs'
// The change pauses the routes and waits out the registry caches before switching.
export const maxDuration = 300
type Ctx = { params: Promise<{ projectId: string }> }

async function projectName(projectId: string): Promise<string | null> {
  const { data } = await createServiceRoleClient().from('pype_voice_projects').select('name').eq('id', projectId).maybeSingle()
  return (data?.name as string | undefined) ?? null
}

function parseDesired(body: Record<string, unknown>): DesiredRoute[] | string {
  if (!Array.isArray(body.routes) || body.routes.length === 0) return 'routes must be a non-empty array'
  const out: DesiredRoute[] = []
  for (const r of body.routes as Record<string, unknown>[]) {
    if (!DATA_TYPES.includes(r?.data_type as DataType)) return 'unknown data_type'
    if (r.destination_id !== null && typeof r.destination_id !== 'string') return 'destination_id must be a string or null (null = back to Pype)'
    out.push({ data_type: r.data_type as DataType, destination_id: r.destination_id as string | null })
  }
  return out
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  const { projectId } = await params
  const name = await projectName(projectId)
  if (!name) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  return NextResponse.json({ project: { id: projectId, name }, routes: await getRegistryStore().listRoutes(projectId) })
}

/**
 * Set routes. `?dryRun=1` reports the check result, the active calls and the audit entry
 * without changing anything. Applying needs the project name typed in `confirm`.
 */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  const { projectId } = await params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const desired = parseDesired(body)
  if (typeof desired === 'string') return NextResponse.json({ error: desired }, { status: 400 })

  const name = await projectName(projectId)
  if (!name) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  if (!dryRun && body.confirm !== name) return NextResponse.json({ error: 'Type the project name to confirm' }, { status: 400 })

  try {
    // The plane the project has now, taken before anything is paused, counts the calls in flight.
    const plane = await getDataPlaneResolver().forProject(projectId)
    const result = await changeProjectRoutes({
      projectId,
      desired,
      actor: admin.email,
      dryRun,
      force: body.force === true,
      store: getRegistryStore(),
      activeCalls: () => countActiveCalls(plane, projectId),
    })
    return NextResponse.json(result, { status: result.ok ? 200 : result.status })
  } catch (e) {
    if (e instanceof DataPlaneError) return NextResponse.json({ error: e.message, code: e.code }, { status: 503 })
    throw e
  }
}
