import { useQuery } from '@tanstack/react-query'
import type { CampaignFlowSummary } from '@/lib/campaignFlows/types'

function toSummary(row: any): CampaignFlowSummary {
  return {
    flowId: row.flow_id,
    name: row.name,
    description: row.description ?? '',
    status: row.status,
    agentId: row.agent_id ?? undefined,
    n8nWorkflowId: row.n8n_workflow_id ?? undefined,
    updatedAt: row.updated_at,
  }
}

export function useCampaignFlows(projectId?: string | null) {
  return useQuery<CampaignFlowSummary[]>({
    queryKey: ['campaign-flows', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/campaign-flows?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch campaign flows')
      const { flows } = await res.json()
      return (flows ?? []).map(toSummary)
    },
    enabled: !!projectId,
    staleTime: 30_000,
  })
}
