// Instant dispositions for a call that just ended.
//
// The saved call's dispositions are computed downstream (export -> analytics
// lambda -> extractor -> DB), which takes a while. The Studio already holds the
// live transcript at hang-up, so this runs the same extraction prompt on it
// directly with a small fast model and returns in a second or two. Display
// only: nothing is written, and the persisted values replace these once the
// call lands.

import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { buildSystemPrompt, buildUserPrompt, parseFieldExtractorPrompt } from '@/lib/transcriptProcessor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_TURNS = 200
const MAX_CHARS = 60_000
const PREVIEW_MODEL = process.env.DISPOSITION_PREVIEW_MODEL || 'gpt-4o-mini'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params
  const body = await request.json().catch(() => null)
  const turns: unknown = body?.turns
  if (!Array.isArray(turns) || turns.length === 0) {
    return NextResponse.json({ error: 'turns is required' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: agent } = await supabase
    .from('pype_voice_agents')
    .select('project_id, field_extractor, field_extractor_prompt')
    .eq('id', agentId)
    .single()
  if (!agent?.project_id) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const role = await getProjectRoleForApi(agent.project_id as string)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!agent.field_extractor || !agent.field_extractor_prompt) {
    return NextResponse.json({ values: {} })
  }
  const fields = parseFieldExtractorPrompt(agent.field_extractor_prompt as string)
  if (fields.length === 0) return NextResponse.json({ values: {} })

  const transcript = turns
    .slice(-MAX_TURNS)
    .map((t: any) => `${t?.speaker === 'agent' ? 'AGENT' : 'USER'}: ${String(t?.text ?? '')}`)
    .join('\n')
    .slice(-MAX_CHARS)

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, timeout: 20_000 })
    const res = await openai.chat.completions.create({
      model: PREVIEW_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(fields) },
        { role: 'user', content: buildUserPrompt(fields, transcript) },
      ],
    })
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}')
    const values: Record<string, string> = {}
    for (const f of fields) {
      const v = parsed?.[f.key]
      if (v !== undefined && v !== null) values[f.key] = typeof v === 'object' ? JSON.stringify(v) : String(v)
    }
    return NextResponse.json({ values })
  } catch (err) {
    console.error('Disposition preview failed:', err)
    return NextResponse.json({ error: 'Could not compute dispositions right now' }, { status: 502 })
  }
}
