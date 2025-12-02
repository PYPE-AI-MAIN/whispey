// src/app/api/reprocess-call-logs/count/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
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

    // Build base query with count
    let query = supabase
      .from('pype_voice_call_logs')
      .select('*', { count: 'exact', head: true })

    // Filter by agent_id if provided
    if (agent_id) {
      query = query.eq('agent_id', agent_id)
    } else if (project_id) {
      // If no agent_id but project_id, get all agents for this project first
      const { data: agents } = await supabase
        .from('pype_voice_agents')
        .select('id')
        .eq('project_id', project_id)

      if (agents && agents.length > 0) {
        const agentIds = agents.map(a => a.id)
        query = query.in('agent_id', agentIds)
      } else {
        // No agents found, return 0
        return NextResponse.json({ count: 0 })
      }
    }

    // Filter by date range
    query = query
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString())

    // Apply reprocess_type filters for empty_only
    if (reprocess_type === 'empty_only') {
      if (reprocess_options === 'transcription') {
        if (transcription_fields.length > 0) {
          // Check if specific transcription fields are missing
          // Use .not() to check if field exists, then invert with .or() for any missing
          // For now, use a simpler approach: check if transcription_metrics is null/empty
          // OR if any of the specific fields are missing
          // Note: Supabase's .or() with JSONB paths is complex, so we'll use a general check
          // The actual filtering by specific fields will be done in the Lambda function
          query = query.or('transcription_metrics.is.null,transcription_metrics.eq.{}')
        } else {
          // Count logs with null or empty transcription_metrics
          query = query.or('transcription_metrics.is.null,transcription_metrics.eq.{}')
        }
      } else if (reprocess_options === 'metrics') {
        if (metrics_fields.length > 0) {
          // Similar approach for metrics
          query = query.or('metrics.is.null,metrics.eq.{}')
        } else {
          // Count logs with null or empty metrics
          query = query.or('metrics.is.null,metrics.eq.{}')
        }
      } else if (reprocess_options === 'both') {
        // Count logs where transcription_metrics is null/empty OR metrics is null/empty
        query = query.or('transcription_metrics.is.null,transcription_metrics.eq.{},metrics.is.null,metrics.eq.{}')
      }
    }
    // If reprocess_type is 'all', no additional filters needed
    // Note: When specific transcription_fields or metrics_fields are provided,
    // the count may be approximate. The Lambda function will apply the exact field-level filtering.

    const { count, error: countError } = await query

    if (countError) {
      console.error('Count error:', countError)
      return NextResponse.json(
        { error: 'Failed to count call logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({ count: count || 0 })
  } catch (error) {
    console.error('Count call logs error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

