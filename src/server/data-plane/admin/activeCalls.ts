import { createServiceRoleClient } from '@/lib/supabase-server'
import type { DataPlane } from '../ports'

const IN_FLIGHT_WINDOW_MS = 2 * 60 * 60 * 1000

/**
 * Calls of this project that started recently and have not ended, read through the
 * plane the project has now.
 * ponytail: a call-log heuristic. The worker's active-call table is the exact source;
 * swap it in when the dashboard can read it.
 */
export async function countActiveCalls(plane: DataPlane, projectId: string, now = Date.now()): Promise<number> {
  const { data } = await createServiceRoleClient().from('pype_voice_agents').select('id').eq('project_id', projectId)
  const agentIds = (data ?? []).map((a: { id: string }) => a.id)
  if (agentIds.length === 0) return 0
  return plane.callData.countCallLogs({
    agentIds,
    dateColumn: 'call_started_at',
    from: new Date(now - IN_FLIGHT_WINDOW_MS).toISOString(),
    filters: [{ column: 'call_ended_at', operator: 'is', value: null }],
  })
}
