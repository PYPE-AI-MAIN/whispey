import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

// GET /api/agents/prod-list?project_id=xxx
// Returns all prod-tagged agents in the same project — used for merge target dropdown
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ message: 'project_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pype_voice_agents')
      .select('id, name')
      .eq('project_id', projectId)
      .eq('environment', 'prod')
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json({ agents: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ message: 'Failed to fetch prod agents', error: err.message }, { status: 500 })
  }
}
