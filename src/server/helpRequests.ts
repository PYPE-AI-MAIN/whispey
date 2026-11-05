// Sends an "Ask Pype for help" request to Jira (Delivery Ops). Nothing is
// stored on our side: if Jira is not configured or the call fails, the caller
// gets an error and can try again. Jira settings come from env:
//   JIRA_BASE_URL     e.g. https://pypeai-jira.atlassian.net
//   JIRA_EMAIL        the account the API token belongs to
//   JIRA_API_TOKEN    API token for that account
//   JIRA_PROJECT_KEY  where issues are created, e.g. KAN
//   JIRA_ISSUE_TYPE   optional, defaults to "Task"

import { createServiceRoleClient } from '@/lib/supabase-server'
import { buildJiraIssue, type HelpRequestFacts, type HelpRequestInput } from '@/lib/helpRequests'
import { studioUrl } from '@/lib/mcpAgentHelpers'

type Supabase = ReturnType<typeof createServiceRoleClient>

export interface FileHelpRequest extends HelpRequestInput {
  source: 'studio' | 'mcp'
  projectId: string
  agentId?: string | null
  requesterEmail?: string | null
  mcpClientId?: string | null
  lastCallId?: string | null
}

export type FiledHelpRequest = { ok: true; jiraKey: string } | { ok: false; status: number; error: string }

const TRY_AGAIN = 'Could not send your request to Pype right now. Please try again in a few minutes.'

function jiraConfig() {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY, JIRA_ISSUE_TYPE } = process.env
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) return null
  return {
    baseUrl: JIRA_BASE_URL.endsWith('/') ? JIRA_BASE_URL.slice(0, -1) : JIRA_BASE_URL,
    auth: Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64'),
    projectKey: JIRA_PROJECT_KEY,
    issueType: JIRA_ISSUE_TYPE || 'Task',
  }
}

async function createJiraIssue(facts: HelpRequestFacts): Promise<FiledHelpRequest> {
  const cfg = jiraConfig()
  if (!cfg) {
    console.error('[help-request] Jira is not configured (JIRA_BASE_URL/JIRA_EMAIL/JIRA_API_TOKEN/JIRA_PROJECT_KEY)')
    return { ok: false, status: 503, error: TRY_AGAIN }
  }
  try {
    const res = await fetch(`${cfg.baseUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: { Authorization: `Basic ${cfg.auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildJiraIssue(facts, cfg.projectKey, cfg.issueType)),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.key) {
      console.error(`[help-request] Jira ${res.status}: ${JSON.stringify(data).slice(0, 500)}`)
      return { ok: false, status: 502, error: TRY_AGAIN }
    }
    return { ok: true, jiraKey: String(data.key) }
  } catch (err) {
    console.error('[help-request] Jira request failed:', err)
    return { ok: false, status: 502, error: TRY_AGAIN }
  }
}

export async function fileHelpRequest(supabase: Supabase, req: FileHelpRequest): Promise<FiledHelpRequest> {
  const [{ data: project }, agentRes] = await Promise.all([
    supabase.from('pype_voice_projects').select('name').eq('id', req.projectId).maybeSingle(),
    req.agentId
      ? supabase.from('pype_voice_agents').select('name, display_name, project_id').eq('id', req.agentId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (!project) return { ok: false, status: 404, error: 'Project not found' }
  const agent = agentRes.data as { name?: string; display_name?: string; project_id?: string } | null
  // An agent id from the caller must belong to the claimed project.
  if (req.agentId && agent?.project_id !== req.projectId) {
    return { ok: false, status: 404, error: 'Agent not found in this project' }
  }

  return createJiraIssue({
    category: req.category,
    message: req.message,
    source: req.source,
    projectId: req.projectId,
    projectName: (project as { name?: string }).name,
    agentId: req.agentId,
    agentName: agent?.display_name || agent?.name || null,
    requester: req.requesterEmail || (req.mcpClientId ? `MCP client ${req.mcpClientId}` : null),
    studioUrl: req.agentId ? studioUrl(req.projectId, req.agentId, process.env.NEXT_PUBLIC_APP_URL) : null,
    lastCallId: req.lastCallId,
  })
}
