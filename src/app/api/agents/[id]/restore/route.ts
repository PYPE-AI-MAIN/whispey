import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { pushPromptToGitHub, enrichSnapshotForGitHub } from '@/lib/github-prompts'
import { mintServiceToken } from '@/lib/serviceToken'

const supabase = createServiceRoleClient()

function extractPromptSnapshot(config: any): string | null {
  return config?.agent?.assistant?.[0]?.prompt ?? config?.agent?.prompt ?? null
}

function parseDeployError(errText: string): string {
  try {
    const j = JSON.parse(errText)
    return j?.error ?? j?.message ?? errText ?? 'unknown'
  } catch {
    return errText || 'unknown'
  }
}

type DeployError = { message: string; status: number }

async function runDeploy(
  appUrl: string,
  isPipecat: boolean,
  configSnapshot: any,
  agentId: string,
  agentName: string,
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
  } else {
    const res = await fetch(`${appUrl}/api/agents/save-and-deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintServiceToken()}` },
      body: JSON.stringify({ agent: configSnapshot.agent, metadata: { agentId, agentName } }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[restore] LiveKit deploy failed:', res.status, errText)
      return { message: `Restore deploy failed: ${parseDeployError(errText)}`, status: 502 }
    }
  }
  return null
}

async function fetchCallbackSettings(agentId: string): Promise<any> {
  const schedulerUrl = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN || process.env.SCHEDULER_API_URL || ''
  if (!schedulerUrl) return null
  try {
    const res = await fetch(`${schedulerUrl}/api/v1/agents/${agentId}/callback-settings`, {
      headers: { 'x-api-key': process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data && Object.keys(data).length > 0 ? data : null
  } catch {
    return null
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await req.json()
    const { version_id, commit_message, userEmail, userId } = body

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
      .select('id, name, project_id, environment')
      .eq('id', agentId)
      .single()

    if (aErr || !agent) {
      return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
    }

    if (agent.environment === 'prod') {
      return NextResponse.json({ message: 'Cannot restore on a production agent.' }, { status: 403 })
    }

    // 3. Deploy the old config back to the dev agent
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const isPipecat = version.config_snapshot?.platform === 'pipecat'
    const deployErr = await runDeploy(appUrl, isPipecat, version.config_snapshot, agentId, agent.name)
    if (deployErr) return NextResponse.json({ message: deployErr.message }, { status: deployErr.status })

    // 4. Push restored config as YAML to GitHub (same enrichment as regular save)
    const { data: project } = await supabase
      .from('pype_voice_projects')
      .select('name')
      .eq('id', agent.project_id)
      .single()

    const projectName = project?.name ?? agent.project_id
    const agentName = agent.name ?? agentId

    const [webhookRes, dropoffRes] = await Promise.all([
      supabase
        .from('pype_voice_webhook_configs')
        .select('webhook_name, webhook_url, http_method, headers, trigger_events, is_active')
        .eq('agent_id', agentId),
      supabase
        .from('pype_voice_agent_dropoff_settings')
        .select('enabled, dropoff_message, delay_minutes, max_retries, context_dropoff_prompt, sip_trunk_id, phone_number_id')
        .eq('agent_id', agentId)
        .eq('is_active', true)
        .maybeSingle(),
    ])

    const callbackSettings = await fetchCallbackSettings(agentId)

    const githubSnapshot = enrichSnapshotForGitHub(
      version.config_snapshot,
      webhookRes.data,
      dropoffRes.data,
      callbackSettings,
    )

    const githubResult = await pushPromptToGitHub(
      projectName,
      agentName,
      githubSnapshot,
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
