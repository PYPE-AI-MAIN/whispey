import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/server/admin/requirePlatformAdmin'
import { getRegistryStore } from '@/server/data-plane/admin/registryStore'
import { checkDetach, parseDestinationInput } from '@/server/data-plane/routingPolicy'

export const runtime = 'nodejs'
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  const { id } = await params
  const parsed = parseDestinationInput((await request.json().catch(() => ({}))) as Record<string, unknown>, true)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const store = getRegistryStore()
  // Changing where a destination points changes where its projects' data goes, so it is not editable while routed.
  const touchesAddress = parsed.value.config !== undefined || parsed.value.secret_ref !== undefined || parsed.value.kind !== undefined
  const blocked = touchesAddress ? checkDetach(await store.routeCountFor(id)) : null
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 })
  const destination = await store.updateDestination(id, parsed.value)
  if (!destination) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await store.addAudit({ action: 'destination_update', actor_email: admin.email, after: { id, fields: Object.keys(parsed.value) } })
  return NextResponse.json({ destination })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  const { id } = await params
  const store = getRegistryStore()
  const blocked = checkDetach(await store.routeCountFor(id))
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 })
  await store.deleteDestination(id)
  await store.addAudit({ action: 'destination_delete', actor_email: admin.email, after: { id } })
  return NextResponse.json({ ok: true })
}
