/**
 * The bell.
 *
 * Notifications are written by the lambda when an insight is delivered, and
 * scoped to a project. They are filtered here by what the caller can actually
 * see, rather than at write time, because membership changes and a row written
 * last week should not leak to someone added since.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guarded } from '@/server/analytics/guard'
import { resolveProjectAccess, isQaDenied, qaDb } from '@/server/qa/access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = guarded('qa/notifications', async (req: NextRequest) => {
  const projectId = req.nextUrl.searchParams.get('projectId') || ''
  const unreadOnly = req.nextUrl.searchParams.get('unread') === 'true'

  const access = await resolveProjectAccess(projectId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  let q = qaDb
    .from('qa_notifications')
    .select('id, agent_id, insight_id, kind, title, body, link, read_at, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (unreadOnly) q = q.is('read_at', null)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: 'Could not load notifications' }, { status: 500 })

  const rows = (data || []).filter((n) => !n.agent_id || access.agentIds.includes(n.agent_id))
  return NextResponse.json({
    notifications: rows,
    unread: rows.filter((n) => !n.read_at).length,
  })
})

const PatchBody = z.object({
  projectId: z.string().uuid(),
  // omit to mark every visible notification read
  ids: z.array(z.string().uuid()).max(100).optional(),
})

export const PATCH = guarded('qa/notifications:read', async (req: NextRequest) => {
  const parsed = PatchBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const access = await resolveProjectAccess(parsed.data.projectId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  let q = qaDb
    .from('qa_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('project_id', parsed.data.projectId)
    .is('read_at', null)

  if (parsed.data.ids?.length) q = q.in('id', parsed.data.ids)

  const { error } = await q
  if (error) return NextResponse.json({ error: 'Could not update notifications' }, { status: 500 })

  return NextResponse.json({ ok: true })
})
