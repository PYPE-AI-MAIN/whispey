import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent_id')
  const projectId = searchParams.get('project_id')

  if (!agentId || !projectId) {
    return NextResponse.json({ error: 'agent_id and project_id required' }, { status: 400 })
  }

  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('pype_voice_promptforge_sessions')
      .select('*')
      .eq('agent_id', agentId)
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    console.error('[prompt-forge/sessions GET]', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { agent_id, project_id, created_by } = await request.json()
    if (!agent_id || !project_id) {
      return NextResponse.json({ error: 'agent_id and project_id required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('pype_voice_promptforge_sessions')
      .insert({
        agent_id,
        project_id,
        created_by: created_by ?? null,
        name: 'Untitled session',
        system_prompt: '',
        variables: [],
        tools: [],
        messages: [],
        model: 'gpt-4o-mini',
        provider: 'openai',
        temperature: 0.7,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    console.error('[prompt-forge/sessions POST]', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
