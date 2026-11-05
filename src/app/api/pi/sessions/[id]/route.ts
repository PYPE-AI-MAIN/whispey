// src/app/api/pi/sessions/[id]/route.ts
//
// One session: full history (to resume), rename, delete. All three are the
// session's own user only — no role can read someone else's chat.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { ownsSession, verifiedEmail } from '@/lib/piOwner'

export const runtime = 'nodejs'

type LoadResult = { ok: true; session: any } | { ok: false; status: number; error: string }

async function loadSession(id: string): Promise<LoadResult> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.from('pi_sessions').select('*').eq('id', id).maybeSingle()
  if (error) return { ok: false, status: 500, error: error.message }
  if (!data) return { ok: false, status: 404, error: 'Not found' }
  return { ok: true, session: data }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const loaded = await loadSession(id)
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const { session } = loaded

  const access = await getProjectRoleForApi(session.project_id)
  if (!access) return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
  if (!ownsSession(session, userId, await verifiedEmail())) return NextResponse.json({ error: 'Not your session' }, { status: 403 })

  return NextResponse.json(session)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const loaded = await loadSession(id)
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const { session } = loaded
  if (!ownsSession(session, userId, await verifiedEmail())) return NextResponse.json({ error: 'Not your session' }, { status: 403 })

  const { title } = await request.json().catch(() => ({}))
  if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('pi_sessions').update({ title: title.trim().slice(0, 120), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const loaded = await loadSession(id)
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const { session } = loaded
  if (!ownsSession(session, userId, await verifiedEmail())) return NextResponse.json({ error: 'Not your session' }, { status: 403 })

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('pi_sessions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
