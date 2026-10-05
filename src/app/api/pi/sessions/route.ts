// src/app/api/pi/sessions/route.ts
//
// Pi's session list — same table-as-JSON-blob shape Prompt Forge already
// uses (pype_voice_promptforge_sessions), but scoped for real: 'mine' is the
// signed-in user's own chats, 'team' (owner/admin only) is every session in
// the project, which is what makes "who has been asking Pi to do what" an
// actual answerable question instead of a column nobody writes to.

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'

export const runtime = 'nodejs'

const LIST_COLUMNS = 'id, title, user_email, created_at, updated_at, messages'

function withMessageCount(row: any) {
  const { messages, ...rest } = row
  return { ...rest, message_count: Array.isArray(messages) ? messages.length : 0 }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  const scope = searchParams.get('scope') === 'team' ? 'team' : 'mine'
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const access = await getProjectRoleForApi(projectId)
  if (!access) return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
  if (scope === 'team' && access.role !== 'owner' && access.role !== 'admin') {
    return NextResponse.json({ error: 'Only project owners/admins can see team activity' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  let query = supabase.from('pi_sessions').select(LIST_COLUMNS).eq('project_id', projectId).order('updated_at', { ascending: false }).limit(200)
  if (scope === 'mine') query = query.eq('user_id', userId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(withMessageCount))
}

export async function POST(request: NextRequest) {
  const { projectId } = await request.json().catch(() => ({}))
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const access = await getProjectRoleForApi(projectId)
  if (!access) return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })

  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? 'unknown'

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pi_sessions')
    .insert({ project_id: projectId, user_id: userId, user_email: userEmail, title: 'New chat', messages: [] })
    .select('id, title, user_email, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, message_count: 0 }, { status: 201 })
}
