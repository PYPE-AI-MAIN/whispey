import { NextRequest, NextResponse } from 'next/server'
import { isQaDenied, qaDb, resolveAgentAccess } from '@/server/qa/access'
import { lastFullWeek, weekEndOf, weekError } from '@/lib/qaAudit'

/** Weekly review requests for one agent, newest week first. */
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId') ?? ''
  const access = await resolveAgentAccess(agentId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  const { data, error } = await qaDb
    .from('qa_weekly_reviews')
    .select('id, week_start, week_end, requested_by_email, requested_at, status, sheet_url, note, ready_at')
    .eq('agent_id', agentId)
    .order('week_start', { ascending: false })
    .limit(52)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reviews: data ?? [], canManage: access.canManage, suggestedWeek: lastFullWeek(new Date()) })
}

/** Ask the QA team to review one finished week of this agent's calls. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { agentId?: string; weekStart?: string }
  const access = await resolveAgentAccess(body.agentId ?? '')
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  const weekStart = body.weekStart ?? lastFullWeek(new Date()).weekStart
  const invalid = weekError(weekStart, new Date())
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const { data, error } = await qaDb
    .from('qa_weekly_reviews')
    .insert({
      agent_id: access.agent.id,
      project_id: access.projectId,
      week_start: weekStart,
      week_end: weekEndOf(weekStart),
      requested_by_user_id: access.userId,
      requested_by_email: access.email,
    })
    .select('id, week_start, week_end, status, requested_at')
    .single()
  if (error?.code === '23505') {
    return NextResponse.json({ error: 'A review for that week was already requested' }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ review: data }, { status: 201 })
}
