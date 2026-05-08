import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  }

  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('pype_voice_metrics_logs')
      .select('id, user_transcript, agent_response, tool_calls, unix_timestamp, created_at')
      .eq('session_id', sessionId)
      .order('unix_timestamp', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    console.error('[prompt-forge/turns]', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
