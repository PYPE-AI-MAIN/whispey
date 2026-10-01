/**
 * Who gets QA email.
 *
 * Recipients are plain email addresses, not Whispey users — a hospital ops lead
 * who never logs in is exactly who this is for. We verify our own sending
 * domain once; a recipient never verifies anything.
 *
 * `contents` is the setting that matters: an ops lead wants to know the booking
 * flow is dropping people, a prompt engineer wants the diff. Same insight, two
 * different emails.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guarded } from '@/server/analytics/guard'
import { resolveProjectAccess, isQaDenied, qaDb } from '@/server/qa/access'
import { currentUser } from '@clerk/nextjs/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = guarded('qa/subs', async (req: NextRequest) => {
  const projectId = req.nextUrl.searchParams.get('projectId') || ''

  const access = await resolveProjectAccess(projectId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  const { data, error } = await qaDb
    .from('qa_subscriptions')
    .select('id, email, agent_id, cadence, contents, active, created_by, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Could not load subscriptions' }, { status: 500 })

  // only show rows for agents this person can see
  const rows = (data || []).filter((r) => !r.agent_id || access.agentIds.includes(r.agent_id))
  return NextResponse.json({ subscriptions: rows, canWrite: access.canWrite })
})

const PostBody = z.object({
  projectId: z.string().uuid(),
  email: z.string().email().max(320),
  agentId: z.string().uuid().nullable().optional(),
  cadence: z.enum(['as_it_happens', 'daily', 'weekly', 'campaign_end']).default('as_it_happens'),
  contents: z.enum(['insights', 'insights_and_prompts']).default('insights'),
})

export const POST = guarded('qa/subs:create', async (req: NextRequest) => {
  const parsed = PostBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the email address and try again' }, { status: 400 })
  }

  const { projectId, email, agentId, cadence, contents } = parsed.data
  const access = await resolveProjectAccess(projectId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.canWrite) {
    return NextResponse.json({ error: 'You need admin access to change who gets QA email' }, { status: 403 })
  }
  if (agentId && !access.agentIds.includes(agentId)) {
    return NextResponse.json({ error: 'You do not have access to that agent' }, { status: 403 })
  }

  const user = await currentUser()

  const { error } = await qaDb.from('qa_subscriptions').upsert(
    {
      project_id: projectId,
      email: email.toLowerCase().trim(),
      agent_id: agentId ?? null,
      cadence,
      contents,
      active: true,
      created_by: user?.emailAddresses?.[0]?.emailAddress || null,
    },
    { onConflict: 'email,project_id,agent_id' },
  )

  if (error) {
    console.error('[qa/subs:create]', error)
    return NextResponse.json({ error: 'Could not save that subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
})

export const DELETE = guarded('qa/subs:delete', async (req: NextRequest) => {
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: sub } = await qaDb
    .from('qa_subscriptions')
    .select('id, project_id')
    .eq('id', id)
    .maybeSingle()

  if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const access = await resolveProjectAccess(sub.project_id)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.canWrite) {
    return NextResponse.json({ error: 'You need admin access to change who gets QA email' }, { status: 403 })
  }

  await qaDb.from('qa_subscriptions').delete().eq('id', id)
  return NextResponse.json({ ok: true })
})
