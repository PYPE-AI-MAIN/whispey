// Deploys a conversation-flow workflow to the voice backend and keeps the
// dashboard's copy in sync. Shared by the canvas Deploy button
// (/api/workflow/[agentName]) and the MCP flow routes; each caller does its
// own permission check first.

import { createServiceRoleClient } from '@/lib/supabase-server'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import {
  getPypeApiBaseUrlForServer,
  isPypeUpstreamUnreachable,
  pypeApiAbortSignal,
  PYPE_API_DEPLOY_TIMEOUT_MS,
} from '@/lib/pypeApiFetch'

type Supabase = ReturnType<typeof createServiceRoleClient>

export type DeployResult =
  | { ok: true; data: unknown; warning?: string }
  | { ok: false; status: number; message: string; error?: string; unreachable?: boolean }

/** Keep Supabase's copy in sync so the dashboard's own config history/diff UI
 * sees it too. DynamoDB (already updated by the backend deploy call) is what
 * the running worker actually reads at call time, so it's the source of truth
 * for what's LIVE — this is a secondary, display-only copy. A hiccup here
 * must not report the whole deploy as failed (the caller's outer catch would
 * say "Unexpected error deploying workflow" even though the real, functional
 * deploy already succeeded) — the caller surfaces this as its own smaller
 * warning instead. Returns the error message, or undefined on success. */
async function syncWorkflowToSupabase(
  supabase: Supabase,
  agentRow: { id: string; configuration: unknown },
  workflow: unknown
): Promise<string | undefined> {
  try {
    const { error } = await supabase
      .from('pype_voice_agents')
      .update({ configuration: { ...(agentRow.configuration as object), workflow } })
      .eq('id', agentRow.id)
    return error?.message
  } catch (err: any) {
    return err?.message || 'unknown error'
  }
}

export async function deployWorkflow(
  supabase: Supabase,
  agentRow: { id: string; configuration: unknown },
  backendAgentName: string,
  workflow: unknown
): Promise<DeployResult> {
  const baseUrl = getPypeApiBaseUrlForServer()
  if (!baseUrl) {
    return { ok: false, status: 500, message: 'Missing PYPEAI_API_URL or NEXT_PUBLIC_PYPEAI_API_URL' }
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/workflow/${encodeURIComponent(backendAgentName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
      // Forward the real agent row id so the backend stores it as the config's
      // agent_id. Without it save_agent_config() mints a uuid5(agent_name) and
      // every call gets logged to Whispey under that phantom id — invisible in
      // this agent's call logs.
      body: JSON.stringify({ workflow, agent_id: agentRow.id }),
      signal: pypeApiAbortSignal(PYPE_API_DEPLOY_TIMEOUT_MS),
    })
  } catch (err) {
    if (isPypeUpstreamUnreachable(err)) {
      return {
        ok: false,
        status: 503,
        message: 'Voice backend unreachable. The workflow could not be deployed.',
        unreachable: true,
      }
    }
    throw err
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    return { ok: false, status: response.status, message: `Failed to deploy workflow: ${response.status}`, error: errorText || undefined }
  }

  const data = await response.json().catch(() => ({}))

  const supabaseSyncError = await syncWorkflowToSupabase(supabase, agentRow, workflow)
  if (supabaseSyncError) {
    console.error(`[workflow deploy] backend deploy succeeded but Supabase sync failed for agent ${agentRow.id}: ${supabaseSyncError}`)
    return {
      ok: true,
      data,
      warning: `Deployed successfully, but the dashboard's own copy failed to sync (${supabaseSyncError}) — refresh to see the latest.`,
    }
  }
  return { ok: true, data }
}
