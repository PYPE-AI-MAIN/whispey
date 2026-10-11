import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { SNAPSHOT_FIELDS, loadForgeSession, pickFields } from '@/server/promptForge/access'

export const runtime = 'nodejs'

// Save = freeze the current draft (prompt, settings, greeting and the
// transcript so far) as the next version, and keep the draft in step. The
// draft stays editable; versions never change once written. Owner only.
// Saving an unowned session (from before owners were recorded) makes the
// saver its owner.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionid: string }> },
) {
  const { sessionid } = await params
  const loaded = await loadForgeSession(sessionid, { edit: true })
  if ('response' in loaded) return loaded.response
  const { session, user } = loaded

  try {
    const body = await request.json()
    const snapshot = { ...pickFields(session, SNAPSHOT_FIELDS), ...pickFields(body, SNAPSHOT_FIELDS) }
    const supabase = createServiceRoleClient()

    // Two saves racing for the same number: the unique (session_id, version)
    // index rejects the second, which then takes the next number.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: last } = await supabase
        .from('pype_voice_promptforge_session_versions')
        .select('version')
        .eq('session_id', sessionid)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      const { data: version, error } = await supabase
        .from('pype_voice_promptforge_session_versions')
        .insert({
          ...snapshot,
          session_id: sessionid,
          version: (last?.version ?? 0) + 1,
          note: typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 200) : null,
          created_by: user.userId,
          created_by_email: user.email,
        })
        .select('id, version, note, created_by_email, created_at')
        .single()
      if (error?.code === '23505') continue
      if (error) throw error

      await supabase
        .from('pype_voice_promptforge_sessions')
        .update({ ...snapshot, ...(session.created_by ? {} : { created_by: user.userId }), updated_at: new Date().toISOString() })
        .eq('id', sessionid)
      return NextResponse.json(version, { status: 201 })
    }
    return NextResponse.json({ error: 'Could not save — please try again' }, { status: 409 })
  } catch (err: any) {
    console.error('[prompt-forge/versions POST]', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
