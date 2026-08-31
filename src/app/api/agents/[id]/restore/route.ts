import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { pushEnrichedConfigToGitHub } from '@/lib/agentVersionHelpers'
import { mintServiceToken } from '@/lib/serviceToken'

// This route calls into /api/agents/save-and-deploy, then (for docker agents)
// polls until the background container swap actually finishes, then pushes
// to GitHub and writes to Supabase on top of that. A real docker deploy alone
// can take ~90-100s, so the budget here has to cover deploy + poll + GitHub +
// Supabase, not just the deploy call.
export const maxDuration = 180

const UPDATE_POLL_INTERVAL_MS = 2000
const UPDATE_POLL_MAX_MS = 150 * 1000 // leave headroom under maxDuration for GitHub push + Supabase writes
const TERMINAL_UPDATE_STATUSES = new Set(['completed', 'failed', 'rolled_back'])

const supabase = createServiceRoleClient()

function extractPromptSnapshot(config: any): string | null {
  return config?.agent?.assistant?.[0]?.prompt ?? config?.agent?.prompt ?? null
}

function parseDeployError(errText: string): string {
  try {
    const j = JSON.parse(errText)
    // j?.error / j?.message can themselves be objects depending on the
    // upstream error shape (e.g. FastAPI's HTTPException(detail={...}) nests
    // one level deeper than expected here). Interpolating a non-string into
    // the "Restore deploy failed: ${...}" template below would silently
    // stringify it to the literal text "[object Object]" instead of
    // surfacing anything useful — stringify explicitly so real error detail
    // is always visible.
    const candidate = j?.detail?.message ?? j?.detail?.error ?? j?.detail ?? j?.error ?? j?.message ?? errText
    if (typeof candidate === 'string') return candidate
    return JSON.stringify(candidate) || errText || 'unknown'
  } catch {
    return errText || 'unknown'
  }
}

type DeployError = { message: string; status: number }

// Mirrors the polling loop in useAgentConfig.ts's saveAndDeployAgent, but
// server-side: the docker backend returns "update_started" immediately and
// runs the actual container swap in the background, so a fast 200 here does
// NOT mean the deploy finished — only that it started.
async function pollDeployStatus(appUrl: string, agentName: string): Promise<DeployError | null> {
  const deadline = Date.now() + UPDATE_POLL_MAX_MS

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, UPDATE_POLL_INTERVAL_MS))

    const res = await fetch(`${appUrl}/api/agents/update-status/${encodeURIComponent(agentName)}`, {
      headers: { Authorization: `Bearer ${mintServiceToken()}` },
    })
    if (!res.ok) continue // transient — keep polling until the deadline

    const status = await res.json().catch(() => null)
    if (!status || status.status === 'no_update_found' || status.status === 'unreachable') continue
    if (TERMINAL_UPDATE_STATUSES.has(status.status)) {
      if (status.status !== 'completed' || status.success === false) {
        const failureDetail = status.error || `update ended with status: ${status.status}`
        return { message: `Restore deploy failed: ${failureDetail}`, status: 502 }
      }
      return null
    }
  }

  return { message: 'Restore deploy timed out waiting for the agent update to complete', status: 504 }
}

async function runDeploy(
  appUrl: string,
  isPipecat: boolean,
  configSnapshot: any,
  agentId: string,
  agentName: string,
  deploymentTarget: 'classic' | 'docker',
  callerUserId: string | null,
): Promise<DeployError | null> {
  if (isPipecat) {
    const pipecatAgentId = configSnapshot?.agent?.whispey_agent_id
    if (!pipecatAgentId) {
      return { message: 'Cannot determine Pipecat agent ID from snapshot.', status: 400 }
    }
    const res = await fetch(`${appUrl}/api/pipecat/agents/${pipecatAgentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintServiceToken()}` },
      body: JSON.stringify(configSnapshot.agent),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[restore] Pipecat deploy failed:', res.status, errText)
      return { message: `Restore deploy failed: ${parseDeployError(errText)}`, status: 502 }
    }
    return null
  }

  const res = await fetch(`${appUrl}/api/agents/save-and-deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintServiceToken()}` },
    // callerUserId: this is a server-to-server call authenticated by the service
    // token above, not a Clerk session — save-and-deploy's superadmin check
    // (resolveDeploymentTarget) would otherwise see no session and silently
    // downgrade any requested 'docker' target to 'classic'. We already resolved
    // the real caller's role in this route's own request (which DOES have a
    // Clerk session), so forward it as an already-verified id instead.
    body: JSON.stringify({ agent: configSnapshot.agent, metadata: { agentId, agentName }, deploymentTarget, callerUserId }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[restore] LiveKit deploy failed:', res.status, errText)
    return { message: `Restore deploy failed: ${parseDeployError(errText)}`, status: 502 }
  }

  // Classic deploys synchronously and this response IS the final result.
  // Docker deploys in the background and returns "update_started" — poll
  // until it actually finishes before treating the restore as successful.
  const body = await res.json().catch(() => null)
  if (deploymentTarget === 'docker' && body?.data?.status === 'update_started') {
    return pollDeployStatus(appUrl, agentName)
  }
  return null
}


export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await req.json()
    const { version_id, commit_message, userEmail, userId } = body
    // The real, Clerk-verified caller — resolved here (this route has an
    // actual browser session) so it can be forwarded to save-and-deploy's
    // superadmin check, which otherwise sees no session on our internal
    // service-token-authenticated call and silently downgrades to 'classic'.
    const { userId: callerUserId } = await auth()

    if (!version_id || !commit_message?.trim()) {
      return NextResponse.json({ message: 'version_id and commit_message are required' }, { status: 400 })
    }

    // 1. Load the target version — must belong to this agent
    const { data: version, error: vErr } = await supabase
      .from('pype_agent_config_versions')
      .select('*')
      .eq('id', version_id)
      .eq('agent_id', agentId)
      .single()

    if (vErr || !version) {
      return NextResponse.json({ message: 'Version not found' }, { status: 404 })
    }

    if (!version.config_snapshot) {
      return NextResponse.json({ message: 'This version has no config snapshot.' }, { status: 400 })
    }

    // 2. Verify this is a dev agent
    const { data: agent, error: aErr } = await supabase
      .from('pype_voice_agents')
      .select('id, name, project_id, environment, configuration')
      .eq('id', agentId)
      .single()

    if (aErr || !agent) {
      return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
    }

    if (agent.environment === 'prod') {
      return NextResponse.json({ message: 'Cannot restore on a production agent.' }, { status: 403 })
    }

    // 3. Deploy the old config back to the dev agent — must match this agent's
    // ACTUAL deployment target, not just be omitted (save-and-deploy defaults
    // any unspecified target to 'classic', which would silently deploy a
    // docker agent's restore to the wrong backend entirely).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const isPipecat = version.config_snapshot?.platform === 'pipecat'
    const deploymentTarget: 'classic' | 'docker' =
      (agent as any).configuration?.deployment_target === 'docker' ? 'docker' : 'classic'
    // agent.name is the short display name from pype_voice_agents — the backend
    // (and the update_status poll) needs the full ID-suffixed name that's actually
    // stored in the config snapshot itself (e.g. "D_SH_Radio_b4ed5204_..."), not
    // the short one, or polling 404s against a name the backend never registered.
    const fullAgentName: string = version.config_snapshot?.agent?.name || agent.name
    const deployErr = await runDeploy(appUrl, isPipecat, version.config_snapshot, agentId, fullAgentName, deploymentTarget, callerUserId)
    if (deployErr) return NextResponse.json({ message: deployErr.message }, { status: deployErr.status })

    // 4. Push restored config as YAML to GitHub (same enrichment as regular save)
    const { data: project } = await supabase
      .from('pype_voice_projects')
      .select('name')
      .eq('id', agent.project_id)
      .single()

    const projectName = project?.name ?? agent.project_id
    const agentName = agent.name ?? agentId

    const githubResult = await pushEnrichedConfigToGitHub(
      agentId,
      version.config_snapshot,
      projectName,
      agentName,
      commit_message.trim(),
      userEmail ?? 'unknown',
    )

    // 5. Save a new version row with the old config and new commit message
    const { data: latest } = await supabase
      .from('pype_agent_config_versions')
      .select('version_number')
      .eq('agent_id', agentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (latest?.version_number ?? 0) + 1
    const promptSnapshot = version.prompt_snapshot ?? extractPromptSnapshot(version.config_snapshot)

    const { data: inserted, error: insErr } = await supabase
      .from('pype_agent_config_versions')
      .insert({
        agent_id: agentId,
        project_id: agent.project_id,
        version_number: nextVersion,
        config_snapshot: version.config_snapshot,
        prompt_snapshot: promptSnapshot ?? null,
        commit_message: commit_message.trim(),
        created_by_email: userEmail ?? null,
        created_by_user_id: userId ?? null,
        github_sha: githubResult?.sha ?? null,
        github_push_ok: githubResult !== null,
      })
      .select('id')
      .single()

    if (insErr) {
      return NextResponse.json({ message: insErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      version_number: nextVersion,
      version_id: (inserted as any)?.id ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ message: 'Restore failed', error: err.message }, { status: 500 })
  }
}
