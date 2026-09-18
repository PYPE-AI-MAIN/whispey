import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

export async function GET(_request: NextRequest, { params }: { params: Promise<{ flowId: string }> }) {
  try {
    const { flowId } = await params

    const { data: flow, error } = await supabase
      .from('campaign_flows')
      .select('*')
      .eq('flow_id', flowId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Campaign flow not found' }, { status: 404 })
    }

    return NextResponse.json({ flow })
  } catch (error) {
    console.error('Unexpected error fetching campaign flow:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ flowId: string }> }) {
  try {
    const { flowId } = await params
    const body = await request.json()
    const { name, description, agentId, graph, status, n8nWorkflowId } = body

    // Only touch columns the caller actually sent — a save from the builder
    // (name/graph/agentId) shouldn't accidentally null out n8nWorkflowId or
    // status just because it didn't know about them.
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) patch.name = name
    if (description !== undefined) patch.description = description
    if (agentId !== undefined) patch.agent_id = agentId
    if (graph !== undefined) patch.graph = graph
    if (status !== undefined) patch.status = status
    if (n8nWorkflowId !== undefined) patch.n8n_workflow_id = n8nWorkflowId

    const { data: flow, error } = await supabase
      .from('campaign_flows')
      .update(patch)
      .eq('flow_id', flowId)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating campaign flow:', error)
      return NextResponse.json({ error: 'Failed to update campaign flow' }, { status: 500 })
    }

    return NextResponse.json({ flow })
  } catch (error) {
    console.error('Unexpected error updating campaign flow:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ flowId: string }> }) {
  try {
    const { flowId } = await params

    const { error } = await supabase.from('campaign_flows').delete().eq('flow_id', flowId)

    if (error) {
      console.error('Error deleting campaign flow:', error)
      return NextResponse.json({ error: 'Failed to delete campaign flow' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error deleting campaign flow:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
