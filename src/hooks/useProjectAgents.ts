import { useQuery } from '@tanstack/react-query'

export interface ProjectAgent {
  id: string
  name: string
  display_name?: string | null
  configuration?: { pipecat_agent_id?: string | null } | null
}

/** Full agent rows (incl. `display_name`) for a project — for resolving display names at render time. */
export function useProjectAgents(projectId?: string | null) {
  return useQuery<ProjectAgent[]>({
    queryKey: ['agents', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/agents?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch agents')
      const data = await res.json()
      return Array.isArray(data) ? data : (data.agents ?? [])
    },
    enabled: !!projectId,
    staleTime: 30_000,
  })
}
