import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/server/admin/requirePlatformAdmin'
import { getRegistryStore } from '@/server/data-plane/admin/registryStore'
import { verifyPostgrestDestination } from '@/server/data-plane/adapters/postgrest'
import { SECRET_REF } from '@/server/data-plane/routingPolicy'
import { SUPPORTED_SCHEMA_VERSION, resolveSecret, resolveClientCert } from '@/server/data-plane/resolver'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Key rotation for a destination that is already routed. The customer first adds the NEW public key (new kid) to
 * their JWKS next to the old one; this route then checks the new key works against the destination and only then
 * switches the registry to it. The address does not change, so it is allowed while routes exist. The customer removes
 * the old key afterwards. Caches hold the old key for at most a minute.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { kid?: unknown; secret_ref?: unknown }
  if (typeof body.kid !== 'string' || !/^[\w.:-]{1,128}$/.test(body.kid)) return NextResponse.json({ error: 'kid is required' }, { status: 400 })
  if (typeof body.secret_ref !== 'string' || !SECRET_REF.test(body.secret_ref)) return NextResponse.json({ error: 'secret_ref must be an AWS Secrets Manager ARN (or env:NAME)' }, { status: 400 })

  const store = getRegistryStore()
  const dest = await store.getDestinationForVerify(id)
  if (!dest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (dest.kind !== 'postgrest') return NextResponse.json({ error: 'Only customer destinations have a key' }, { status: 400 })

  const config: Record<string, any> = { ...dest.config, kid: body.kid }
  let checks
  try {
    const key = await resolveSecret(body.secret_ref)
    const clientCert = config.mtls === true ? await resolveClientCert(body.secret_ref) : undefined
    checks = await verifyPostgrestDestination({ id: dest.id, name: dest.name, config }, key, SUPPORTED_SCHEMA_VERSION, clientCert)
  } catch (e) {
    checks = [{ name: 'secret', ok: false, detail: e instanceof Error ? e.message : 'failed' }]
  }
  if (!checks.every((c) => c.ok)) return NextResponse.json({ rotated: false, checks }, { status: 400 })

  await store.updateDestination(id, { config, secret_ref: body.secret_ref })
  await store.recordHealth(id, 'healthy', { checks })
  await store.addAudit({ action: 'destination_rotate_key', actor_email: admin.email, before: { kid: dest.config.kid ?? null }, after: { id, kid: body.kid } })
  return NextResponse.json({ rotated: true, checks })
}
