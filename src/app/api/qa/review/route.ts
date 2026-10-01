/**
 * The listening list: which calls a person should hear, and why.
 *
 * GET  — the queue for an agent
 * POST — "Ask QA to check this": builds the list from an insight and tells the
 *        QA team there is something waiting
 * PATCH — a reviewer confirming or rejecting what the machine found
 *
 * Every item carries a written reason. A call with no reason never goes on the
 * list, because the whole point is that a reviewer opens calls in an order that
 * means something instead of working down a flagged list of a hundred.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guarded } from '@/server/analytics/guard'
import { resolveAgentAccess, isQaDenied, qaDb } from '@/server/qa/access'
import { currentUser } from '@clerk/nextjs/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = guarded('qa/review', async (req: NextRequest) => {
  const agentId = req.nextUrl.searchParams.get('agentId') || ''
  const status = req.nextUrl.searchParams.get('status')

  const access = await resolveAgentAccess(agentId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  let q = qaDb
    .from('qa_review_items')
    .select('id, call_log_id, reason, rank, status, note, assigned_to, created_at, insight_id')
    .eq('agent_id', agentId)
    .order('rank', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: 'Could not load the review list' }, { status: 500 })

  return NextResponse.json({ items: data || [] })
})

const PostBody = z.object({
  agentId: z.string().uuid(),
  insightId: z.string().uuid().optional(),
  ask: z.string().max(2000).optional(),
})

export const POST = guarded('qa/review:create', async (req: NextRequest) => {
  const parsed = PostBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { agentId, insightId, ask } = parsed.data
  const access = await resolveAgentAccess(agentId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  const user = await currentUser()
  const requestedBy = user?.emailAddresses?.[0]?.emailAddress || 'unknown'

  // The night job already wrote a ranked list alongside the insight. Asking QA
  // to check it is about telling a person, not about recomputing anything.
  const { data: existing } = await qaDb
    .from('qa_review_items')
    .select('id, call_log_id, reason')
    .eq('agent_id', agentId)
    .eq('status', 'pending')
    .order('rank', { ascending: true })
    .limit(25)

  let items = existing || []

  if (!items.length) {
    // No pre-built list — fall back to the calls behind the insight's bullets.
    const { data: insight } = insightId
      ? await qaDb.from('qa_insights').select('bullets').eq('id', insightId).maybeSingle()
      : { data: null }

    const bullets = (insight?.bullets as Array<{ issue_key?: string; call_ids?: string[]; text?: string }>) || []
    const rows: Array<{ call_log_id: string; reason: string; rank: number }> = []
    const seen = new Set<string>()

    bullets.forEach((b, i) => {
      for (const callId of (b.call_ids || []).slice(0, 5)) {
        if (seen.has(callId)) continue
        seen.add(callId)
        rows.push({ call_log_id: callId, reason: b.text?.slice(0, 300) || 'From the current insight', rank: i + 1 })
      }
    })

    if (!rows.length) {
      return NextResponse.json({ error: 'There are no calls to review for this agent right now' }, { status: 404 })
    }

    const { data: inserted, error } = await qaDb
      .from('qa_review_items')
      .insert(rows.map((r) => ({
        ...r,
        agent_id: agentId,
        project_id: access.projectId,
        insight_id: insightId || null,
        requested_by: requestedBy,
      })))
      .select('id, call_log_id, reason')

    if (error) return NextResponse.json({ error: 'Could not build the review list' }, { status: 500 })
    items = inserted || []
  }

  // Tell our own QA team. Deliberately not a client subscription — this is our
  // queue and it must not depend on a client having configured anything.
  const agentLabel = access.agent.display_name || access.agent.name
  await qaDb.from('qa_notifications').insert({
    project_id: access.projectId,
    agent_id: agentId,
    insight_id: insightId || null,
    kind: 'review_request',
    title: `QA review requested: ${agentLabel}`,
    body: ask ? `Asked for: ${ask}` : `${items.length} calls to listen to, ranked, each with a reason.`,
    link: `/${access.projectId}/agents/${agentId}/qa?tab=review`,
  })

  // The actual mail to the Pype QA team. Best-effort: the review list and the
  // in-app notification above are the source of truth and already saved —
  // losing this one HTTP call should not fail the request.
  let mailed = false
  const lambdaUrl = process.env.QA_LAMBDA_API_URL
  if (lambdaUrl) {
    try {
      const res = await fetch(`${lambdaUrl}/qa/notify-review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-pype-token': process.env.PYPE_API_KEY || 'pype-api-v1' },
        body: JSON.stringify({ agent_id: agentId, project_id: access.projectId, insight_id: insightId || null }),
      })
      const body = await res.json().catch(() => null)
      mailed = Boolean(res.ok && (body?.emailsSent ?? 0) > 0)
    } catch (err) {
      console.error('QA notify-review call failed:', err)
    }
  }

  return NextResponse.json({ ok: true, count: items.length, items, mailed })
})

const PatchBody = z.object({
  itemId: z.string().uuid(),
  status: z.enum(['pending', 'in_review', 'done', 'skipped']).optional(),
  note: z.string().max(2000).optional(),
  // confirming or rejecting what the machine found on this call
  verdicts: z.array(z.object({
    issueKey: z.string(),
    status: z.enum(['confirmed', 'rejected']),
  })).max(30).optional(),
})

export const PATCH = guarded('qa/review:update', async (req: NextRequest) => {
  const parsed = PatchBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { itemId, status, note, verdicts } = parsed.data

  const { data: item } = await qaDb
    .from('qa_review_items')
    .select('id, agent_id, call_log_id')
    .eq('id', itemId)
    .maybeSingle()

  if (!item) return NextResponse.json({ error: 'Review item not found' }, { status: 404 })

  const access = await resolveAgentAccess(item.agent_id)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress || 'unknown'

  if (status || note !== undefined) {
    await qaDb
      .from('qa_review_items')
      .update({ ...(status ? { status } : {}), ...(note !== undefined ? { note } : {}), assigned_to: email })
      .eq('id', itemId)
  }

  // Confirm/reject is also how we measure the judge: the running
  // confirmed-vs-rejected ratio per issue type is its accuracy score.
  if (verdicts?.length) {
    for (const v of verdicts) {
      await qaDb
        .from('qa_call_issues')
        .update({ status: v.status, confirmed_by: email, confirmed_at: new Date().toISOString() })
        .eq('call_log_id', item.call_log_id)
        .eq('issue_key', v.issueKey)
    }
  }

  return NextResponse.json({ ok: true })
})
