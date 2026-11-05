// src/app/api/reprocess-call-logs/count/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { withDataPlane, rethrowDataPlane, projectIdForAgent } from '@/server/data-plane'

const supabase = createServiceRoleClient()

export const GET = withDataPlane(async (dp, request: NextRequest) => {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const from_date = searchParams.get('from_date')
    const to_date = searchParams.get('to_date')
    const reprocess_type = searchParams.get('reprocess_type')
    const reprocess_options = searchParams.get('reprocess_options')
    const agent_id = searchParams.get('agent_id')
    const project_id = searchParams.get('project_id')
    
    // Parse optional field arrays
    let transcription_fields: string[] = []
    let metrics_fields: string[] = []
    try {
      const transcriptionFieldsParam = searchParams.get('transcription_fields')
      if (transcriptionFieldsParam) {
        transcription_fields = JSON.parse(transcriptionFieldsParam)
      }
      const metricsFieldsParam = searchParams.get('metrics_fields')
      if (metricsFieldsParam) {
        metrics_fields = JSON.parse(metricsFieldsParam)
      }
    } catch (e) {
      console.error('Error parsing field arrays:', e)
    }

    // Validation
    if (!from_date || !to_date) {
      return NextResponse.json(
        { error: 'from_date and to_date are required' },
        { status: 400 }
      )
    }

    if (!reprocess_type || !['empty_only', 'all'].includes(reprocess_type)) {
      return NextResponse.json(
        { error: 'reprocess_type must be "empty_only" or "all"' },
        { status: 400 }
      )
    }

    if (!reprocess_options || !['transcription', 'metrics', 'both'].includes(reprocess_options)) {
      return NextResponse.json(
        { error: 'reprocess_options must be "transcription", "metrics", or "both"' },
        { status: 400 }
      )
    }

    // Validate date format
    const fromDate = new Date(from_date)
    const toDate = new Date(to_date)
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format' },
        { status: 400 }
      )
    }

    // The calls live in the project's data plane, so an agent or project hint is required.
    if (!agent_id && !project_id) {
      return NextResponse.json({ error: 'agent_id or project_id is required' }, { status: 400 })
    }
    const projectOfCalls = agent_id ? await projectIdForAgent(agent_id) : project_id
    if (!projectOfCalls) return NextResponse.json({ count: 0 })
    const plane = await dp.forProject(projectOfCalls)

    let agentIds: string[]
    if (agent_id) {
      agentIds = [agent_id]
    } else {
      // No agent_id but project_id: all agents of this project
      const { data: agents } = await supabase
        .from('pype_voice_agents')
        .select('id')
        .eq('project_id', project_id)
      if (!agents || agents.length === 0) return NextResponse.json({ count: 0 })
      agentIds = agents.map(a => a.id)
    }

    // When specific transcription_fields or metrics_fields are given the count is
    // approximate: exact field-level filtering happens in the Lambda function.
    const emptyColumns =
      reprocess_type !== 'empty_only' ? undefined
      : reprocess_options === 'transcription' ? ['transcription_metrics']
      : reprocess_options === 'metrics' ? ['metrics']
      : ['transcription_metrics', 'metrics']

    let count: number
    try {
      count = await plane.callData.countCallLogs({
        agentIds,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        emptyColumns,
      })
    } catch (countError) {
      rethrowDataPlane(countError)
      console.error('Count error:', countError)
      return NextResponse.json(
        { error: 'Failed to count call logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({ count })
  } catch (error) {
    rethrowDataPlane(error)
    console.error('Count call logs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

