import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getCallerGlobalRole } from '@/lib/prod-auth'
import { teamMemberError } from '@/lib/qaAudit'

export const runtime = 'nodejs'

async function superadminOnly() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getCallerGlobalRole(userId)) !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET() {
  const denied = await superadminOnly()
  if (denied) return denied
  const { data, error } = await createServiceRoleClient().from('qa_team_members').select('id, name, email, role, slack_id').order('role').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: data ?? [] })
}

export async function POST(request: NextRequest) {
  const denied = await superadminOnly()
  if (denied) return denied
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const check = teamMemberError(body)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: 400 })
  const { data, error } = await createServiceRoleClient().from('qa_team_members').insert(check.member).select('id, name, email, role, slack_id').single()
  if (error?.code === '23505') return NextResponse.json({ error: 'That person already has this role' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const denied = await superadminOnly()
  if (denied) return denied
  const id = request.nextUrl.searchParams.get('id') ?? ''
  const { error } = await createServiceRoleClient().from('qa_team_members').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
