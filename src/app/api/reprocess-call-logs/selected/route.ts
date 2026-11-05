// POST /api/reprocess-call-logs/selected
// Reanalyze the calls picked in Call Logs. Body:
//   { agent_id, log_ids: string[], reprocess_type: 'empty_only'|'all', reprocess_options: 'transcription'|'metrics'|'both' }
// The analytics lambda works on a date range, so each completed call is sent as
// its own request with from_date = to_date = its exact created_at, which
// matches that one call. Returns { queued, skipped, failed }.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { canShowOrgSection } from '@/types/visibility'
import { REANALYZE_CONCURRENCY, parseLogIds, runLimited } from '@/lib/reprocessSelection'

const REPROCESS_API_BASE_URL = process.env.NEXT_PUBLIC_REPROCESS_API_BASE_URL ||
  process.env.NEXT_PUBLIC_PYPEAI_API_URL ||
  'https://xxxxx.execute-api.ap-south-1.amazonaws.com/dev'

const TYPES = new Set(['empty_only', 'all'])
const OPTIONS = new Set(['transcription', 'metrics', 'both'])

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const { agent_id, log_ids, reprocess_type, reprocess_options } = body
  if (typeof agent_id !== 'string' || !agent_id) {
    return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
  }
  const parsed = parseLogIds(log_ids)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (typeof reprocess_type !== 'string' || !TYPES.has(reprocess_type)) {
    return NextResponse.json({ error: 'reprocess_type must be "empty_only" or "all"' }, { status: 400 })
  }
  if (typeof reprocess_options !== 'string' || !OPTIONS.has(reprocess_options)) {
    return NextResponse.json({ error: 'reprocess_options must be "transcription", "metrics", or "both"' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: agent } = await supabase.from('pype_voice_agents').select('project_id').eq('id', agent_id).maybeSingle()
  if (!agent?.project_id) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  // Same rule as the Reanalyze option in Call Logs
  const access = await getProjectRoleForApi(agent.project_id)
  if (!access || !canShowOrgSection(access.visibility, 'reanalyze')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only this agent's calls; the lambda only reanalyzes completed ones.
  const { data: rows, error } = await supabase
    .from('pype_voice_call_logs')
    .select('id, created_at, call_ended_reason')
    .eq('agent_id', agent_id)
    .in('id', parsed.ids)
  if (error) {
    console.error('Reanalyze selected: call lookup failed', error)
    return NextResponse.json({ error: 'Could not look up the calls' }, { status: 500 })
  }
  const calls = (rows ?? []).filter((r) => r.call_ended_reason === 'completed' && r.created_at)

  const apiUrl = `${REPROCESS_API_BASE_URL}/reprocess-call-logs`
  const results = await runLimited(calls, REANALYZE_CONCURRENCY, async (call) => {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // created_at exactly as stored (microseconds), so the range is this one call
        body: JSON.stringify({
          from_date: call.created_at,
          to_date: call.created_at,
          reprocess_type,
          reprocess_options,
          agent_id,
          project_id: agent.project_id,
        }),
      })
      if (!res.ok) console.error(`Reanalyze selected: lambda returned ${res.status} for ${call.id}`)
      return res.ok
    } catch (e) {
      console.error(`Reanalyze selected: lambda unreachable for ${call.id}`, e)
      return false
    }
  })

  const queued = results.filter(Boolean).length
  const failed = results.length - queued
  const skipped = parsed.ids.length - calls.length
  if (calls.length > 0 && queued === 0) {
    return NextResponse.json({ error: 'Could not start reanalyzing. Try again.', queued, skipped, failed }, { status: 502 })
  }
  return NextResponse.json({ queued, skipped, failed })
}
