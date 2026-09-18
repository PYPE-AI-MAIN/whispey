import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const { data: flows, error } = await supabase
      .from('campaign_flows')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching campaign flows:', error)
      return NextResponse.json({ error: 'Failed to fetch campaign flows' }, { status: 500 })
    }

    return NextResponse.json({ flows })
  } catch (error) {
    console.error('Unexpected error fetching campaign flows:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, name, description, agentId, graph } = body

    if (!projectId || !name || !graph) {
      return NextResponse.json({ error: 'projectId, name, and graph are required' }, { status: 400 })
    }

    const { data: flow, error } = await supabase
      .from('campaign_flows')
      .insert({
        project_id: projectId,
        name,
        description: description ?? null,
        agent_id: agentId ?? null,
        graph,
        status: 'draft',
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating campaign flow:', error)
      return NextResponse.json({ error: 'Failed to create campaign flow' }, { status: 500 })
    }

    return NextResponse.json({ flow })
  } catch (error) {
    console.error('Unexpected error creating campaign flow:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
