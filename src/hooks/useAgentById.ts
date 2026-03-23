'use client'

import { useQuery } from '@tanstack/react-query'

/**
 * Fetches agent by ID from our API. The API returns role-based data:
 * - Viewer: agent without field_extractor, field_extractor_prompt, field_extractor_variables, metrics
 * - Admin/Owner: full agent
 * Use this in Dashboard so viewers never receive Field Extractor / Metrics data.
 */
export function useAgentById(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent-by-id', agentId],
    queryFn: async () => {
      if (!agentId) return null
      const res = await fetch(`/api/agents/${agentId}`)
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    },
    enabled: !!agentId,
    staleTime: 60 * 1000,
  })
}
