import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/server/admin/requirePlatformAdmin'
import { getRegistryStore } from '@/server/data-plane/admin/registryStore'

export const runtime = 'nodejs'

/** Audit log, newest first. Filters: projectId, actor, action, from, to, limit. */
export async function GET(request: NextRequest) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  const p = request.nextUrl.searchParams
  const entries = await getRegistryStore().listAudit({
    projectId: p.get('projectId') ?? undefined,
    actor: p.get('actor') ?? undefined,
    action: p.get('action') ?? undefined,
    from: p.get('from') ?? undefined,
    to: p.get('to') ?? undefined,
    limit: Number(p.get('limit')) || undefined,
  })
  return NextResponse.json({ entries })
}
