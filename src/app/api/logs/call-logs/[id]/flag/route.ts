import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { normalizeFlags } from '@/utils/callLogsUtils'

const supabase = createServiceRoleClient()

type FlagAction =
  | { action: 'add'; text: string }
  | { action: 'update'; flagId: string; text: string }
  | { action: 'delete'; flagId: string }

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    const user = await currentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json() as FlagAction

    // Fetch current transcription_metrics + agent_id (to resolve the project for role checks)
    const { data: current, error: fetchError } = await supabase
      .from('pype_voice_call_logs')
      .select('transcription_metrics, agent_id')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    const { data: agent } = await supabase
      .from('pype_voice_agents')
      .select('project_id')
      .eq('id', current?.agent_id)
      .maybeSingle()

    const projectRole = agent?.project_id ? await getProjectRoleForApi(agent.project_id) : null
    if (!projectRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const canDeleteAnyFlag = projectRole.role === 'admin' || projectRole.role === 'owner'

    const existingFlags = normalizeFlags(current?.transcription_metrics?.flag)
    let nextFlags = existingFlags

    if (body.action === 'add') {
      const text = body.text?.trim()
      if (!text) {
        return NextResponse.json({ error: 'Flag text is required' }, { status: 400 })
      }
      nextFlags = [
        ...existingFlags,
        {
          id: randomUUID(),
          text,
          flagged_at: new Date().toISOString(),
          flagged_by: { userId, email: user?.emailAddresses?.[0]?.emailAddress ?? '' },
        },
      ]
    } else if (body.action === 'update') {
      const target = existingFlags.find(f => f.id === body.flagId)
      if (!target) return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
      // Only the author can edit their own flag — admins may delete but not rewrite someone else's.
      if (target.flagged_by?.userId !== userId) {
        return NextResponse.json({ error: 'You can only edit your own flag' }, { status: 403 })
      }
      const text = body.text?.trim()
      if (!text) {
        return NextResponse.json({ error: 'Flag text is required' }, { status: 400 })
      }
      nextFlags = existingFlags.map(f =>
        f.id === body.flagId ? { ...f, text, flagged_at: new Date().toISOString() } : f
      )
    } else if (body.action === 'delete') {
      const target = existingFlags.find(f => f.id === body.flagId)
      if (!target) return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
      const isAuthor = target.flagged_by?.userId === userId
      if (!isAuthor && !canDeleteAnyFlag) {
        return NextResponse.json({ error: 'You can only remove your own flag' }, { status: 403 })
      }
      nextFlags = existingFlags.filter(f => f.id !== body.flagId)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updatedMetrics: Record<string, unknown> = { ...(current?.transcription_metrics || {}) }
    if (nextFlags.length > 0) {
      updatedMetrics.flag = nextFlags
    } else {
      delete updatedMetrics.flag
    }

    const { error } = await supabase
      .from('pype_voice_call_logs')
      .update({ transcription_metrics: updatedMetrics })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true, flags: nextFlags })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error updating call log flag:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
