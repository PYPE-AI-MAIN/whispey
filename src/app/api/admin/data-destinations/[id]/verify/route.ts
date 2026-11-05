import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/server/admin/requirePlatformAdmin'
import { getRegistryStore } from '@/server/data-plane/admin/registryStore'
import { verifyPostgrestDestination, type VerifyCheck } from '@/server/data-plane/adapters/postgrest'
import { createPypePlane } from '@/server/data-plane/adapters/pype'
import { SUPPORTED_SCHEMA_VERSION, resolveSecret } from '@/server/data-plane/resolver'

export const runtime = 'nodejs'
export const maxDuration = 60

async function verify(dest: NonNullable<Awaited<ReturnType<ReturnType<typeof getRegistryStore>['getDestinationForVerify']>>>): Promise<VerifyCheck[]> {
  if (dest.kind === 'pype_supabase') {
    try {
      await createPypePlane().callData.getCallLog('00000000-0000-0000-0000-000000000000', 'id')
      return [{ name: 'connect', ok: true }]
    } catch (e) {
      return [{ name: 'connect', ok: false, detail: e instanceof Error ? e.message : 'failed' }]
    }
  }
  if (!dest.secret_ref) return [{ name: 'secret', ok: false, detail: 'No secret reference set' }]
  try {
    const key = await resolveSecret(dest.secret_ref)
    return await verifyPostgrestDestination({ id: dest.id, name: dest.name, config: dest.config }, key, SUPPORTED_SCHEMA_VERSION)
  } catch (e) {
    return [{ name: 'secret', ok: false, detail: e instanceof Error ? e.message : 'failed' }]
  }
}

/** Runs the attach checklist and records the result as the destination's health. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  const { id } = await params
  const store = getRegistryStore()
  const dest = await store.getDestinationForVerify(id)
  if (!dest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const checks = await verify(dest)
  const healthy = checks.every((c) => c.ok)
  await store.recordHealth(id, healthy ? 'healthy' : 'failed', { checks })
  await store.addAudit({ action: 'destination_verify', actor_email: admin.email, after: { id, healthy } })
  return NextResponse.json({ healthy, checks })
}
