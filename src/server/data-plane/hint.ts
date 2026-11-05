import { createServiceRoleClient } from '@/lib/supabase-server'

/**
 * Routes that start from a call id cannot read the call row to find its project:
 * the row lives wherever the project's route says. The caller therefore sends the
 * agent id as a hint, and the project comes from the agent (control plane, Pype).
 */
export async function projectIdForAgent(agentId: string): Promise<string | null> {
  const { data } = await createServiceRoleClient()
    .from('pype_voice_agents')
    .select('project_id')
    .eq('id', agentId)
    .maybeSingle()
  return (data?.project_id as string | undefined) ?? null
}
