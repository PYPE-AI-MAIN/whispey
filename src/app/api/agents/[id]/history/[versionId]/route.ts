import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/agents/[id]/history/[entryId] — full snapshot + previous for diff
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: agentId, versionId } = await params

    const { data, error } = await supabase
      .from('pype_agent_config_versions')
      .select('*')
      .eq('agent_id', agentId)
      .eq('id', versionId)
      .single()

    if (error || !data) {
      return NextResponse.json({ message: 'History entry not found' }, { status: 404 })
    }

    // Fetch previous entry for diff
    const { data: prev } = await supabase
      .from('pype_agent_config_versions')
      .select('id, version_number, config_snapshot, created_at')
      .eq('agent_id', agentId)
      .lt('version_number', data.version_number)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ entry: data, previousEntry: prev ?? null })
  } catch (err: any) {
    return NextResponse.json(
      { message: 'Failed to fetch history entry', error: err.message },
      { status: 500 }
    )
  }
}
