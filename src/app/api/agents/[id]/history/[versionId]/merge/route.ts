import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { createMergePR, enrichSnapshotForGitHub } from '@/lib/github-prompts'

const supabase = createServiceRoleClient()

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

    if (!version.config_snapshot) {
      return NextResponse.json(
        { message: 'This version has no config snapshot and cannot be merged.' },
        { status: 400 }
      )
    }

    // 2. Load + validate target prod agent
    const { data: targetAgent, error: taErr } = await supabase
      .from('pype_voice_agents')
      .select('id, name, project_id, environment')
      .eq('id', target_agent_id)
      .single()

    if (taErr || !targetAgent) {
      return NextResponse.json({ message: 'Target agent not found' }, { status: 404 })
    }

    if (targetAgent.environment !== 'prod') {
      return NextResponse.json({ message: 'Target agent is not a production agent.' }, { status: 403 })
    }

    // 3. Fetch project name for GitHub folder
    const { data: project } = await supabase
      .from('pype_voice_projects')
      .select('name')
      .eq('id', targetAgent.project_id)
      .single()

    const projectName = project?.name ?? targetAgent.project_id

    // 4. Build PR title + body
    const originalCommitMsg = version.commit_message ?? `v${version.version_number}`
    const prTitle = `Merge dev v${version.version_number} → ${targetAgent.name}: "${originalCommitMsg}"`
    const prBody = [
      `## Prompt update for \`${targetAgent.name}\` (prod)`,
      '',
      `**From:** Dev agent v${version.version_number}`,
      `**Commit:** ${originalCommitMsg}`,
      `**Requested by:** ${userEmail ?? 'unknown'}`,
      '',
      '---',
      'Merging this PR will automatically deploy the full config to the production agent.',
    ].join('\n')

    // 5. Fetch ancillary settings to include in the GitHub YAML (webhook, dropoff, callback)
    const [webhookRes, dropoffRes] = await Promise.all([
      supabase
        .from('pype_voice_webhook_configs')
        .select('webhook_name, webhook_url, http_method, headers, trigger_events, is_active')
        .eq('agent_id', sourceAgentId),
      supabase
        .from('pype_voice_agent_dropoff_settings')
        .select('enabled, dropoff_message, delay_minutes, max_retries, context_dropoff_prompt, sip_trunk_id, phone_number_id')
        .eq('agent_id', sourceAgentId)
        .eq('is_active', true)
        .maybeSingle(),
    ])

    let callbackSettings: any = null
    const schedulerUrl = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN || process.env.SCHEDULER_API_URL || ''
    if (schedulerUrl) {
      try {
        const cbRes = await fetch(`${schedulerUrl}/api/v1/agents/${sourceAgentId}/callback-settings`, {
          headers: { 'x-api-key': process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1' },
          cache: 'no-store',
        })
        if (cbRes.ok) {
          const cbData = await cbRes.json()
          if (cbData && Object.keys(cbData).length > 0) callbackSettings = cbData
        }
      } catch {}
    }

    // Build enriched config: core agent config + ancillary settings for YAML visibility
    const enrichedConfig = enrichSnapshotForGitHub(version.config_snapshot, webhookRes.data, dropoffRes.data, callbackSettings)

    // 6. Create GitHub PR — push enriched config (agent + all settings) as YAML
    const prResult = await createMergePR(
      projectName,
      targetAgent.name,
      enrichedConfig,
      prTitle,
      prBody,
      userEmail ?? 'unknown',
      versionId,
    )

    if (!prResult) {
      return NextResponse.json(
        { message: 'Failed to create GitHub PR. Check PROMPT_GITHUB_REPO and PROMPT_GITHUB_TOKEN.' },
        { status: 502 }
      )
    }

    // 7. Write PR info onto the existing version row.
    //    merged_to_agent_id = target (set now), merged_at = null (still pending).
    //    merged_at being null = PR open; being set = deployed.
    const { data: updatedRow, error: updateErr } = await supabase
      .from('pype_agent_config_versions')
      .update({
        pr_number: prResult.pr_number,
        pr_url: prResult.pr_url,
        merged_to_agent_id: target_agent_id,
      })
      .eq('id', versionId)
      .select('id, pr_number, pr_url, merged_to_agent_id')
      .single()

    if (updateErr) {
      console.error('[merge] Failed to save PR info to version row:', updateErr)
      return NextResponse.json(
        { message: `PR created but failed to save PR info: ${updateErr.message}` },
        { status: 500 }
      )
    }

    console.log('[merge] Saved PR info to version row:', updatedRow)

    return NextResponse.json({
      success: true,
      pr_url: prResult.pr_url,
      pr_number: prResult.pr_number,
    })
  } catch (err: any) {
    return NextResponse.json({ message: 'Failed to create merge PR', error: err.message }, { status: 500 })
  }
}
