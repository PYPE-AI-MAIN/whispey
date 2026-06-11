import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { pushPromptToGitHub } from '@/lib/github-prompts'
import { isProdAuthorized } from '@/lib/prod-auth'

const supabase = createServiceRoleClient()

function sanitizeSnapshot(config: any): any {
  if (!config) return config
  const clone = JSON.parse(JSON.stringify(config))
  if (clone?.agent) {
    delete clone.agent.whispey_api_key
    delete clone.agent.token_hash
    delete clone.agent.whispey_key_id
  }
  return clone
}

function extractPromptSnapshot(config: any): string | null {
  return config?.agent?.assistant?.[0]?.prompt
    ?? config?.agent?.prompt
    ?? null
}

// POST /api/agents/[id]/history — save a version checkpoint
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await req.json()
    const { config, userEmail, userId, commit_message } = body

    if (!config) {
      return NextResponse.json({ message: 'config is required' }, { status: 400 })
    }
    if (!commit_message || !commit_message.trim()) {
      return NextResponse.json({ message: 'commit_message is required' }, { status: 400 })
    }

    // Fetch agent — check environment + get project info
    const { data: agent, error: agentErr } = await supabase
      .from('pype_voice_agents')
      .select('project_id, environment, name')
      .eq('id', agentId)
      .single()

    if (agentErr || !agent) {
      return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
    }

    if (agent.environment === 'prod') {
      // Verify server-side from Clerk session — never trust the email in the request body
      const { userId } = await auth()
      if (!userId) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
      }
      const clerkUser = await currentUser()
      const sessionEmail = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null
      if (!isProdAuthorized(sessionEmail)) {
        return NextResponse.json(
          { message: 'Cannot save versions for a production agent. Edit the dev agent instead.' },
          { status: 403 }
        )
      }
    }

    const snapshot = sanitizeSnapshot(config)
    const promptSnapshot = extractPromptSnapshot(snapshot)

    // Get next version number
    const { data: latest } = await supabase
      .from('pype_agent_config_versions')
      .select('version_number')
      .eq('agent_id', agentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (latest?.version_number ?? 0) + 1

    // Fetch project name for GitHub folder path
    const { data: project } = await supabase
      .from('pype_voice_projects')
      .select('name')
      .eq('id', agent.project_id)
      .single()

    const projectName = project?.name ?? agent.project_id
    const agentName = agent.name ?? agentId

    // Push full config as YAML to agents/{project}/{agent}/config.yml (non-blocking on failure)
    const githubResult = await pushPromptToGitHub(
      projectName,
      agentName,
      snapshot,
      commit_message.trim(),
      userEmail ?? 'unknown',
    )

    // Insert version row
    const { data: inserted, error } = await supabase.from('pype_agent_config_versions').insert({
      agent_id: agentId,
      project_id: agent.project_id,
      version_number: nextVersion,
      config_snapshot: snapshot,
      prompt_snapshot: promptSnapshot ?? null,
      commit_message: commit_message.trim(),
      created_by_email: userEmail ?? null,
      created_by_user_id: userId ?? null,
      github_sha: githubResult?.sha ?? null,
      github_push_ok: githubResult !== null,
    }).select('id').single()

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    // Enforce 100-version retention — delete oldest if over the limit
    const { data: allVersions } = await supabase
      .from('pype_agent_config_versions')
      .select('id')
      .eq('agent_id', agentId)
      .order('version_number', { ascending: true })

    if (allVersions && allVersions.length > 100) {
      const toDelete = allVersions.slice(0, allVersions.length - 100).map((v: { id: string }) => v.id)
      await supabase.from('pype_agent_config_versions').delete().in('id', toDelete)
    }

    return NextResponse.json({
      success: true,
      version_id: (inserted as any)?.id ?? null,
      version_number: nextVersion,
      github_push_ok: githubResult !== null,
    })
  } catch (err: any) {
    return NextResponse.json({ message: 'Failed to save checkpoint', error: err.message }, { status: 500 })
  }
}

// GET /api/agents/[id]/history?page=1&limit=20
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('pype_agent_config_versions')
      .select(
        'id, version_number, created_by_email, created_at, commit_message, prompt_snapshot, github_push_ok, merged_to_agent_id, merged_at',
        { count: 'exact' }
      )
      .eq('agent_id', agentId)
      .order('version_number', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      history: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
        hasMore: offset + limit < (count ?? 0),
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { message: 'Failed to fetch history', error: err.message },
      { status: 500 }
    )
  }
}
