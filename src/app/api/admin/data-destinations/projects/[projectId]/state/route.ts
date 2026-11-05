import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/server/admin/requirePlatformAdmin'
import { getRegistryStore } from '@/server/data-plane/admin/registryStore'

export const runtime = 'nodejs'

/** Pause or resume all of one project's routes. Paused means writes are refused with "try again"; nothing falls back to Pype. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  const { projectId } = await params
  const { action } = (await request.json().catch(() => ({}))) as { action?: string }
  if (action !== 'pause' && action !== 'resume') return NextResponse.json({ error: 'action must be pause or resume' }, { status: 400 })
  const store = getRegistryStore()
  const routes = await store.listRoutes(projectId)
  if (routes.length === 0) return NextResponse.json({ error: 'Project has no routes' }, { status: 404 })
  const state = action === 'pause' ? 'paused' : 'active'
  for (const r of routes) await store.setRouteState(projectId, r.data_type, state)
  await store.addAudit({ action, actor_email: admin.email, project_id: projectId, before: routes.map((r) => ({ data_type: r.data_type, state: r.state })), after: { state } })
  return NextResponse.json({ ok: true, state })
}
