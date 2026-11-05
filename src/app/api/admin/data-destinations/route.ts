import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/server/admin/requirePlatformAdmin'
import { getRegistryStore } from '@/server/data-plane/admin/registryStore'
import { parseDestinationInput } from '@/server/data-plane/routingPolicy'

export const runtime = 'nodejs'

/** Destinations with status and route counts. The secret reference is never returned (has_secret only). */
export async function GET() {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  return NextResponse.json({ destinations: await getRegistryStore().listDestinations() })
}

export async function POST(request: NextRequest) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  const parsed = parseDestinationInput((await request.json().catch(() => ({}))) as Record<string, unknown>)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const store = getRegistryStore()
  try {
    const destination = await store.createDestination(parsed.value as never, admin.email)
    await store.addAudit({ action: 'destination_create', actor_email: admin.email, after: { id: destination.id, name: destination.name, kind: destination.kind } })
    return NextResponse.json({ destination }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: /duplicate|unique/i.test(message) ? 'A destination with that name exists' : message }, { status: /duplicate|unique/i.test(message) ? 409 : 500 })
  }
}
