// src/app/api/pi/sessions/route.ts
//
// Pi's session list — same table-as-JSON-blob shape Prompt Forge already
// uses (pype_voice_promptforge_sessions). A chat is private to the person who
// started it — no role (not even owner/admin) can list or read someone else's.

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { verifiedEmail } from '@/lib/piOwner'

export const runtime = 'nodejs'

const LIST_COLUMNS = 'id, title, user_email, created_at, updated_at, messages'

function withMessageCount(row: any) {
  const { messages, ...rest } = row
  return { ...rest, message_count: Array.isArray(messages) ? messages.length : 0 }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const access = await getProjectRoleForApi(projectId)
  if (!access) return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })

  const supabase = createServiceRoleClient()
  const email = await verifiedEmail()
  const quotedEmail = email?.replaceAll(/[\\"]/g, String.raw`\$&`)
  const mine = quotedEmail ? `user_id.eq.${userId},user_email.eq."${quotedEmail}"` : `user_id.eq.${userId}`
  const { data, error } = await supabase.from('pi_sessions').select(LIST_COLUMNS).eq('project_id', projectId).or(mine).order('updated_at', { ascending: false }).limit(200)
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
