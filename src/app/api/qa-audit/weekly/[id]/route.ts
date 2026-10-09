import { NextRequest, NextResponse } from 'next/server'
import { isQaDenied, qaDb, resolveAgentAccess } from '@/server/qa/access'
import { weeklyPatch } from '@/lib/qaAudit'

/** QA team only: mark a weekly review in progress, or ready with its Google Sheet. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: review } = await qaDb.from('qa_weekly_reviews').select('id, agent_id').eq('id', id).maybeSingle()
  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const access = await resolveAgentAccess(review.agent_id)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.canManage) return NextResponse.json({ error: 'Only the QA team can update reviews' }, { status: 403 })

  const check = weeklyPatch((await request.json().catch(() => ({}))) as Record<string, unknown>)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: 400 })

  const ready = check.patch.status === 'ready'
  const { data, error } = await qaDb
    .from('qa_weekly_reviews')
    .update({
      ...check.patch,
      ready_by: ready ? access.email : null,
      ready_at: ready ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('id, status, sheet_url, note, ready_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ review: data })
}
