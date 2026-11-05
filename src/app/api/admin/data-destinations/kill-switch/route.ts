import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/server/admin/requirePlatformAdmin'
import { getRegistryStore } from '@/server/data-plane/admin/registryStore'

export const runtime = 'nodejs'

/** Pause (or resume) every route that points at a customer destination. Pype-held projects are untouched. */
export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  const { action } = (await request.json().catch(() => ({}))) as { action?: string }
  if (action !== 'pause' && action !== 'resume') return NextResponse.json({ error: 'action must be pause or resume' }, { status: 400 })
  const store = getRegistryStore()
  const routes = await store.listCustomerRoutes()
  const state = action === 'pause' ? 'paused' : 'active'
  for (const r of routes) await store.setRouteState(r.project_id, r.data_type, state)
  await store.addAudit({ action: `kill_switch_${action}`, actor_email: admin.email, after: { routes: routes.length } })
  return NextResponse.json({ ok: true, state, routes: routes.length })
}
