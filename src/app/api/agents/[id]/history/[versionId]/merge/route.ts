import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { pushPromptToGitHub } from '@/lib/github-prompts'

const supabase = createServiceRoleClient()

function extractPromptSnapshot(config: any): string | null {
  return config?.agent?.assistant?.[0]?.prompt
    ?? config?.agent?.prompt
    ?? null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: sourceAgentId, versionId } = await params
    const body = await req.json()
    const { target_agent_id, userEmail, userId } = body

    if (!target_agent_id) {
      return NextResponse.json({ message: 'target_agent_id is required' }, { status: 400 })
    }

    // 1. Load source version — must belong to this agent
    const { data: version, error: vErr } = await supabase
      .from('pype_agent_config_versions')
      .select('*')
      .eq('id', versionId)
      .eq('agent_id', sourceAgentId)
      .single()

    if (vErr || !version) {
      return NextResponse.json({ message: 'Version not found' }, { status: 404 })
    }

    const promptSnapshot: string | null =
      version.prompt_snapshot ?? extractPromptSnapshot(version.config_snapshot)

    if (!promptSnapshot) {
      return NextResponse.json(
        { message: 'This version has no prompt snapshot and cannot be merged.' },
        { status: 400 }
      )
    }

    // 2. Load + validate target prod agent
    const { data: targetAgent, error: taErr } = await supabase
      .from('pype_voice_agents')
      .select('id, name, project_id, environment, configuration')
      .eq('id', target_agent_id)
      .single()

    if (taErr || !targetAgent) {
      return NextResponse.json({ message: 'Target agent not found' }, { status: 404 })
    }

    if (targetAgent.environment !== 'prod') {
      return NextResponse.json({ message: 'Target agent is not a production agent.' }, { status: 403 })
    }

    // 3. Take the FULL dev config snapshot and swap agent identifiers to prod values
    //    This ensures tools, VAD, STT, TTS and all settings are promoted alongside the prompt.
    if (!version.config_snapshot) {
      return NextResponse.json(
        { message: 'This version has no config snapshot and cannot be merged.' },
        { status: 400 }
      )
    }

    const mergedConfig = JSON.parse(JSON.stringify(version.config_snapshot))

    // Replace dev agent identifiers with prod agent identifiers
    if (mergedConfig?.agent) {
      mergedConfig.agent.name = targetAgent.name
      mergedConfig.agent.agent_id = targetAgent.id
      if (Array.isArray(mergedConfig.agent.assistant)) {
        mergedConfig.agent.assistant = mergedConfig.agent.assistant.map((a: any) => ({
          ...a,
          name: targetAgent.name,
        }))
      }
    }

    // 4. Call save-and-deploy for the prod agent with the full merged config
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const deployRes = await fetch(`${appUrl}/api/agents/save-and-deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: mergedConfig.agent,
        metadata: { agentId: target_agent_id, agentName: targetAgent.name },
      }),
    })

    if (!deployRes.ok) {
      const deployErr = await deployRes.json().catch(() => ({}))
      return NextResponse.json(
        { message: `Deploy failed: ${(deployErr as any).message ?? 'unknown error'}` },
        { status: 502 }
      )
    }

    // 5. Get next version number for prod agent
    const { data: prodLatest } = await supabase
      .from('pype_agent_config_versions')
      .select('version_number')
      .eq('agent_id', target_agent_id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextProdVersion = (prodLatest?.version_number ?? 0) + 1

    // 6. Push ONLY the prompt to GitHub under prod agent folder
    const { data: project } = await supabase
      .from('pype_voice_projects')
      .select('name')
      .eq('id', targetAgent.project_id)
      .single()

    const projectName = project?.name ?? targetAgent.project_id

    // Include original commit message so prod history is traceable
    const originalCommitMsg = version.commit_message ?? `v${version.version_number}`
    const prodCommitMsg = `Merged from dev v${version.version_number}: "${originalCommitMsg}" by ${userEmail ?? 'unknown'}`

    const githubResult = await pushPromptToGitHub(
      projectName,
      targetAgent.name,
      promptSnapshot,
      prodCommitMsg,
      userEmail ?? 'unknown',
    )

    // 7. Insert version row for prod agent (full config + original commit message reference)
    await supabase.from('pype_agent_config_versions').insert({
      agent_id: target_agent_id,
      project_id: targetAgent.project_id,
      version_number: nextProdVersion,
      config_snapshot: mergedConfig,
      prompt_snapshot: promptSnapshot,
      commit_message: prodCommitMsg,
      created_by_email: userEmail ?? null,
      created_by_user_id: userId ?? null,
      github_sha: githubResult?.sha ?? null,
      github_push_ok: githubResult !== null,
    })

    // 8. Mark source version row as merged
    await supabase
      .from('pype_agent_config_versions')
      .update({
        merged_to_agent_id: target_agent_id,
        merged_at: new Date().toISOString(),
        merged_by_email: userEmail ?? null,
      })
      .eq('id', versionId)

    return NextResponse.json({
      success: true,
      prod_version_number: nextProdVersion,
      github_push_ok: githubResult !== null,
    })
  } catch (err: any) {
    return NextResponse.json({ message: 'Merge failed', error: err.message }, { status: 500 })
  }
}
