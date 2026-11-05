import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { SESSION_FIELDS, loadForgeSession, ownerEmails, pickFields } from '@/server/promptForge/access'

export const runtime = 'nodejs'

// The session's working draft, whether the caller can edit it, and its saved versions.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionid: string }> },
) {
  const { sessionid } = await params
  const loaded = await loadForgeSession(sessionid)
  if ('response' in loaded) return loaded.response
  const { session, canEdit } = loaded

  const { data: versions } = await createServiceRoleClient()
    .from('pype_voice_promptforge_session_versions')
    .select('id, version, note, created_by_email, created_at')
    .eq('session_id', sessionid)
    .order('version', { ascending: false })
  const emails = await ownerEmails([session.created_by])
  return NextResponse.json({
    ...session,
    owner_email: session.created_by ? emails[session.created_by] ?? null : null,
    can_edit: canEdit,
    versions: versions ?? [],
  })
}

// Changes the working draft (prompt, model, greeting, transcript, name). Owner only.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionid: string }> },
) {
  const { sessionid } = await params
  const loaded = await loadForgeSession(sessionid, { edit: true })
  if ('response' in loaded) return loaded.response
  try {
    const body = await request.json()
    const { data, error } = await createServiceRoleClient()
      .from('pype_voice_promptforge_sessions')
      .update({ ...pickFields(body, SESSION_FIELDS), updated_at: new Date().toISOString() })
      .eq('id', sessionid)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ ...data, can_edit: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionid: string }> },
) {
  const { sessionid } = await params
  const loaded = await loadForgeSession(sessionid, { edit: true })
  if ('response' in loaded) return loaded.response
  try {
    const { error } = await createServiceRoleClient()
      .from('pype_voice_promptforge_sessions')
      .delete()
      .eq('id', sessionid)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
