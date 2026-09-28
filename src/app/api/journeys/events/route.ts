/**
 * Confluence "Analytics Phase 3 and 4 — Build Spec" §3.3. One endpoint, any
 * source, self-describing: a valid project API key can send an event for any
 * journey without registering the campaign or the journey first.
 *
 * No browser session exists here — auth is the same server-to-server pattern
 * send-logs already uses (x-pype-token → sha256 → pype_voice_api_keys), not a
 * new credential system.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { verifyToken } from '@/lib/auth'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { guarded } from '@/server/analytics/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A journey event is a handful of short strings and a small payload, never a
// transcript (§3.1) — 8KB is generous. 600/minute is comfortably above any
// legitimate single-workflow burst (10/sec).
const MAX_BODY_BYTES = 8 * 1024
const RATE_LIMIT_PER_MINUTE = 600

const Body = z.object({
  campaign_key: z.string().min(1).max(200),
  identity_key: z.string().min(1).max(200),
  channel: z.string().min(1).max(50),
  step: z.string().min(1).max(100),
  action: z.string().min(1).max(100),
  agent_id: z.string().uuid().optional(),
  external_ref: z.string().max(200).optional(),
  outcome: z.string().max(100).nullable().optional(),
  payload: z.record(z.unknown()).optional(),
  // Never trusted as-is — checked against the token's own project below.
  project_id: z.string().uuid().optional(),
})

/**
 * Reads the body capped at MAX_BODY_BYTES regardless of what Content-Length
 * claims. Returns null if the cap is exceeded (caller should answer 413).
 */
async function readCappedBody(req: NextRequest): Promise<string | null> {
  const declaredLength = Number(req.headers.get('content-length') ?? '0')
  if (declaredLength > MAX_BODY_BYTES) return null

  const reader = req.body?.getReader()
  if (!reader) return ''

  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8')
}

async function handlePOST(req: NextRequest): Promise<Response> {
  const token = req.headers.get('x-pype-token')
  if (!token) return NextResponse.json({ error: 'Missing x-pype-token' }, { status: 401 })

  const { valid, project_id } = await verifyToken(token)
  if (!valid || !project_id) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const raw = await readCappedBody(req)
  if (raw === null) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })

  let json: unknown = null
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    // falls through to the schema check below, which reports it as a 400
  }

  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const body = parsed.data

  if (body.project_id && body.project_id !== project_id) {
    return NextResponse.json({ error: 'project_id does not match the token' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const { data: requestsThisMinute, error: rateLimitError } = await supabase.rpc('bump_journey_rate_limit', {
    p_token_hash: tokenHash,
  })
  if (rateLimitError) throw rateLimitError
  if ((requestsThisMinute as number) > RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { data: journeyId, error } = await supabase.rpc('ingest_journey_event', {
    p_project_id: project_id,
    p_campaign_key: body.campaign_key,
    p_identity_key: body.identity_key,
    p_channel: body.channel,
    p_step: body.step,
    p_action: body.action,
    p_agent_id: body.agent_id ?? null,
    p_external_ref: body.external_ref ?? null,
    p_outcome: body.outcome ?? null,
    p_payload: body.payload ?? {},
  })
  if (error) throw error

  return NextResponse.json({ journey_id: journeyId })
}

export const POST = guarded('journeys/events', handlePOST)
