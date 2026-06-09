import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

function extractPromptSnapshot(config: any): string | null {
  return config?.agent?.assistant?.[0]?.prompt ?? config?.agent?.prompt ?? null
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

    let deployOk = false

    if (isPipecat) {
      const pipecatAgentId = version.config_snapshot?.agent?.whispey_agent_id
      if (!pipecatAgentId) {
        return NextResponse.json({ message: 'Cannot determine Pipecat agent ID from snapshot.' }, { status: 400 })
      }
      const res = await fetch(`${appUrl}/api/pipecat/agents/${pipecatAgentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(version.config_snapshot.agent),
      })
      deployOk = res.ok
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ message: `Restore deploy failed: ${(err as any).error ?? 'unknown'}` }, { status: 502 })
      }
    } else {
      const res = await fetch(`${appUrl}/api/agents/save-and-deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: version.config_snapshot.agent,
          metadata: { agentId, agentName: agent.name },
        }),
      })
      deployOk = res.ok
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ message: `Restore deploy failed: ${(err as any).message ?? 'unknown'}` }, { status: 502 })
      }
    }

    // 4. Save a new version row with the old config and new commit message
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
        github_push_ok: false,
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
