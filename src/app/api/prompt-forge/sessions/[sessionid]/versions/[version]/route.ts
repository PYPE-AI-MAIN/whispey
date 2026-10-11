import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { loadForgeSession } from '@/server/promptForge/access'

export const runtime = 'nodejs'

// One saved version, read-only — what a shared link (…?v=3) shows.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionid: string; version: string }> },
) {
  const { sessionid, version } = await params
  const loaded = await loadForgeSession(sessionid)
  if ('response' in loaded) return loaded.response
  const n = Number(version)
  if (!Number.isInteger(n) || n < 1) return NextResponse.json({ error: 'Invalid version' }, { status: 400 })

  const { data, error } = await createServiceRoleClient()
    .from('pype_voice_promptforge_session_versions')
    .select('*')
    .eq('session_id', sessionid)
    .eq('version', n)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  return NextResponse.json(data)
}
