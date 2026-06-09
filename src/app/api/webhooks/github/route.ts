import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient()

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false
  try {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(body, 'utf8')
    const digest = `sha256=${hmac.digest('hex')}`
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(digest, 'utf8'))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-hub-signature-256')
    const event = req.headers.get('x-github-event')

    console.log('[webhook/github] Received event:', event, '| signature present:', !!signature)

    const secret = process.env.PROMPT_GITHUB_WEBHOOK_SECRET ?? ''
    if (secret) {
      if (!signature) {
        console.warn('[webhook/github] Secret is set but GitHub sent no signature — check GitHub webhook secret config')
        return NextResponse.json({ message: 'Missing signature' }, { status: 401 })
      }
      if (!verifySignature(rawBody, signature, secret)) {
        console.warn('[webhook/github] Signature mismatch — secret in .env.local does not match GitHub webhook secret')
        return NextResponse.json({ message: 'Invalid signature' }, { status: 401 })
      }
    } else {
      console.warn('[webhook/github] PROMPT_GITHUB_WEBHOOK_SECRET is not set — skipping signature verification')
    }

    if (event !== 'pull_request') {
      return NextResponse.json({ message: 'Ignored' }, { status: 200 })
    }

    const payload = JSON.parse(rawBody)
    if (payload.action !== 'closed' || !payload.pull_request?.merged) {
      console.log('[webhook/github] Not a merge event (action:', payload.action, 'merged:', payload.pull_request?.merged, ')')
      return NextResponse.json({ message: 'Not a merge event' }, { status: 200 })
    }

    const prNumber: number = payload.pull_request.number
    const mergedByEmail: string =
      payload.pull_request.merged_by?.email ??
      payload.pull_request.merged_by?.login ??
      'github'

    console.log('[webhook/github] PR #' + prNumber + ' merged by', mergedByEmail)

    // Find the pending dev version row
    const { data: version, error: vErr } = await supabase
      .from('pype_agent_config_versions')
      .select('*')
      .eq('pr_number', prNumber)
      .is('merged_at', null)
      .not('merged_to_agent_id', 'is', null)
      .maybeSingle()

    if (vErr) {
      console.error('[webhook/github] DB query error:', vErr)
      return NextResponse.json({ message: 'DB error' }, { status: 500 })
    }

    if (!version) {
      console.log('[webhook/github] No pending version found for PR #' + prNumber + ' — not our PR, ignoring')
      return NextResponse.json({ message: 'No pending version found for this PR' }, { status: 200 })
    }

    console.log('[webhook/github] Found version', version.id, '(v' + version.version_number + ') targeting agent', version.merged_to_agent_id)

    const targetAgentId: string = version.merged_to_agent_id

    // Load target prod agent
    const { data: targetAgent, error: taErr } = await supabase
      .from('pype_voice_agents')
      .select('id, name, project_id, environment')
      .eq('id', targetAgentId)
      .single()

    if (taErr || !targetAgent) {
      console.error('[webhook/github] Target agent not found:', targetAgentId, taErr)
      return NextResponse.json({ message: 'Target agent not found' }, { status: 404 })
    }

    // Look up prod agent's latest config snapshot to get its real backend name and Pipecat ID
    const { data: prodSnapshot } = await supabase
      .from('pype_agent_config_versions')
      .select('config_snapshot')
      .eq('agent_id', targetAgentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Voice backend stores agents as "{displayName}_{uuid_with_underscores}".
    // The snapshot's agent.name may only contain the display name, so always build
    // from the target agent's UUID to get the real backend identifier.
    const prodAgentBackendName: string =
      `${targetAgent.name}_${targetAgent.id.replace(/-/g, '_')}`

    console.log('[webhook/github] Prod backend agent name:', prodAgentBackendName)

    // Build merged config:
    //   - Start from dev snapshot (prompt, STT, LLM, TTS, VAD, interruptions, etc.)
    //   - Overwrite prod-specific identifiers so we don't accidentally use dev credentials
    const devAgent = version.config_snapshot?.agent ?? {}
    const prodAgent = prodSnapshot?.config_snapshot?.agent ?? {}

    const mergedAgentConfig: any = {
      ...devAgent,
      // Identity fields — always from prod
      name: prodAgentBackendName,
      agent_id: targetAgent.id,
      type: prodAgent.type ?? devAgent.type ?? 'pype_agent',
      // Credentials — always from prod (dev has its own separate keys)
      whispey_key_id: prodAgent.whispey_key_id ?? devAgent.whispey_key_id,
      whispey_api_key: prodAgent.whispey_api_key ?? devAgent.whispey_api_key,
      // Assistant array — copy dev settings but update name to prod agent name
      assistant: Array.isArray(devAgent.assistant)
        ? devAgent.assistant.map((a: any) => ({ ...a, name: prodAgentBackendName }))
        : devAgent.assistant,
    }

    const mergedConfig = {
      ...version.config_snapshot,
      agent: mergedAgentConfig,
    }

    // Deploy to prod — Pipecat and LiveKit use different endpoints
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const isPipecat = version.config_snapshot?.platform === 'pipecat'

    console.log('[webhook/github] Deploying via', isPipecat ? 'Pipecat' : 'LiveKit', 'endpoint')

    let deployOk = false

    if (isPipecat) {
      const prodPipecatId = prodSnapshot?.config_snapshot?.agent?.whispey_agent_id
      if (!prodPipecatId) {
        console.error('[webhook/github] Cannot determine prod Pipecat agent ID — prod agent has no prior version snapshot')
        return NextResponse.json({ message: 'Cannot determine prod Pipecat agent ID.' }, { status: 400 })
      }

      mergedConfig.agent.whispey_agent_id = prodPipecatId

      const res = await fetch(`${appUrl}/api/pipecat/agents/${prodPipecatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mergedConfig.agent),
      })
      deployOk = res.ok
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[webhook/github] Pipecat deploy failed:', res.status, err)
        return NextResponse.json({ message: 'Pipecat deploy failed' }, { status: 502 })
      }
    } else {
      const res = await fetch(`${appUrl}/api/agents/save-and-deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: mergedConfig.agent,
          metadata: { agentId: targetAgentId, agentName: prodAgentBackendName },
        }),
      })
      deployOk = res.ok
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[webhook/github] LiveKit deploy failed:', res.status, err)
        return NextResponse.json({ message: 'Deploy failed' }, { status: 502 })
      }
    }

    // Get next version number for prod agent
    const { data: prodLatest } = await supabase
      .from('pype_agent_config_versions')
      .select('version_number')
      .eq('agent_id', targetAgentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextProdVersion = (prodLatest?.version_number ?? 0) + 1
    const prodCommitMsg = `Merged from dev v${version.version_number}: "${version.commit_message ?? ''}" by ${mergedByEmail}`

    // Insert prod version row
    await supabase.from('pype_agent_config_versions').insert({
      agent_id: targetAgentId,
      project_id: targetAgent.project_id,
      version_number: nextProdVersion,
      config_snapshot: mergedConfig,
      prompt_snapshot: version.prompt_snapshot,
      commit_message: prodCommitMsg,
      created_by_email: mergedByEmail,
      github_push_ok: true,
    })

    // Mark source dev version as merged
    await supabase
      .from('pype_agent_config_versions')
      .update({
        merged_at: new Date().toISOString(),
        merged_by_email: mergedByEmail,
      })
      .eq('id', version.id)

    console.log(`[webhook/github] PR #${prNumber} merged — deployed to ${prodAgentBackendName} (v${nextProdVersion})`)
    return NextResponse.json({ success: true, prod_version: nextProdVersion })
  } catch (err: any) {
    console.error('[webhook/github] Uncaught error:', err)
    return NextResponse.json({ message: 'Webhook processing failed', error: err.message }, { status: 500 })
  }
}
