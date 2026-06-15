import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getCallerGlobalRole } from '@/lib/prod-auth'

export const runtime = 'nodejs'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerRole = await getCallerGlobalRole(userId)
  if (callerRole !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_voice_users')
    .select('id, email, first_name, last_name, profile_image_url, created_at, roles, clerk_id')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = (data ?? []).map((u: any) => ({
    id: u.id,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    profile_image_url: u.profile_image_url,
    created_at: u.created_at,
    clerk_id: u.clerk_id,
    globalRole: (u.roles?.globalRole ?? 'user') as 'superadmin' | 'prompter' | 'user',
  }))

  return NextResponse.json({ users })
}

export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerRole = await getCallerGlobalRole(userId)
  if (callerRole !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { userId: targetUserId, globalRole } = body as { userId: string; globalRole: 'superadmin' | 'prompter' | 'user' }

  if (!targetUserId || !['superadmin', 'prompter', 'user'].includes(globalRole)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data: target } = await supabase
    .from('pype_voice_users')
    .select('roles')
    .eq('id', targetUserId)
    .single()

  const updatedRoles = { ...(target?.roles ?? {}), globalRole }

  const { data, error } = await supabase
    .from('pype_voice_users')
    .update({ roles: updatedRoles, updated_at: new Date().toISOString() })
    .eq('id', targetUserId)
    .select('id, email, first_name, last_name, roles')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ user: { ...data, globalRole: data.roles?.globalRole ?? 'user' } })
}
