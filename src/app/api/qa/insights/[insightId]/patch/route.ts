/**
 * Apply an insight's suggested prompt change and hand back the patched config.
 *
 * This route deliberately does NOT save or deploy anything. It produces the new
 * config and the client publishes it through `POST /api/agents/[id]/history`,
 * which already handles the production-agent guard, the GitHub push and the
 * merge PR. Re-implementing any of that here would mean two paths to deploy a
 * prompt, which is one more than anyone can keep correct.
 *
 * The reviewer can edit the lines before posting them, so `add` and `remove`
 * come from the request, not from the stored suggestion.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guarded } from '@/server/analytics/guard'
import { resolveAgentAccess, isQaDenied, qaDb } from '@/server/qa/access'
import { applyPatch, readPrompt, writePrompt } from '@/server/qa/applyPatch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({
  remove: z.array(z.string()).max(50).default([]),
  add: z.array(z.string()).max(50).default([]),
})

export const POST = guarded('qa/patch', async (req: NextRequest, ctx: { params: Promise<{ insightId: string }> }) => {
  const { insightId } = await ctx.params

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { data: insight } = await qaDb
    .from('qa_insights')
    .select('id, agent_id, suggested_prompt_patch')
    .eq('id', insightId)
    .maybeSingle()

  if (!insight) return NextResponse.json({ error: 'Insight not found' }, { status: 404 })

  const access = await resolveAgentAccess(insight.agent_id)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.canWrite) {
    return NextResponse.json({ error: 'You need admin access to change a prompt' }, { status: 403 })
  }

  const { data: agentRow } = await qaDb
    .from('pype_voice_agents')
    .select('configuration, environment, name')
    .eq('id', insight.agent_id)
    .maybeSingle()

  const current = readPrompt(agentRow?.configuration)
  if (!current) {
    return NextResponse.json({ error: 'This agent has no prompt we can edit' }, { status: 409 })
  }

  const { remove, add } = parsed.data
  if (!add.length && !remove.length) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  }

  const { prompt: newPrompt, conflicts } = applyPatch(current.prompt, remove, add)

  if (conflicts.length) {
    // The prompt moved on since the suggestion was written. Say so plainly
    // rather than guessing where the line went.
    return NextResponse.json(
      {
        error: 'The prompt has changed since this was suggested, so it could not be applied cleanly.',
        conflicts,
        currentPrompt: current.prompt,
      },
      { status: 409 },
    )
  }

  if (newPrompt === current.prompt) {
    return NextResponse.json({ error: 'That change leaves the prompt exactly as it is' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    agentId: insight.agent_id,
    agentName: agentRow?.name ?? null,
    environment: agentRow?.environment ?? null,
    currentPrompt: current.prompt,
    newPrompt,
    // post this to /api/agents/[id]/history with a commit message to publish
    config: writePrompt(agentRow!.configuration, current.path, newPrompt),
    suggestedCommitMessage: `QA: ${(insight.suggested_prompt_patch as any)?.why || 'prompt fix from QA insight'}`.slice(0, 180),
  })
})
