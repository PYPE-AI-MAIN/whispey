import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { requirePlatformAdmin } from '@/server/admin/requirePlatformAdmin'
import { getRegistryStore } from '@/server/data-plane/admin/registryStore'

export const runtime = 'nodejs'

/** Project picker for the routing screen: projects matching ?q= with their current routes. */
export async function GET(request: NextRequest) {
  const admin = await requirePlatformAdmin()
  if ('response' in admin) return admin.response
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  let query = createServiceRoleClient().from('pype_voice_projects').select('id, name').order('name').limit(50)
  if (q) query = query.ilike('name', `%${q.replaceAll(/[%_,()]/g, '')}%`)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const store = getRegistryStore()
  const projects = await Promise.all(
    (data ?? []).map(async (p: { id: string; name: string }) => ({ ...p, routes: await store.listRoutes(p.id) }))
  )
  return NextResponse.json({ projects })
}
