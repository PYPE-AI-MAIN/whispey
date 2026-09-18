import { CampaignFlowBuilder } from '@/components/campaignFlows/campaign-flow-builder'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { CampaignFlowSummary, FlowNodeData } from '@/lib/campaignFlows/types'
import type { Edge, Node } from '@xyflow/react'

const FALLBACK_NODES: Node<FlowNodeData>[] = [
  {
    id: 'trigger',
    type: 'flow',
    position: { x: 0, y: 0 },
    data: { kind: 'trigger', title: 'Contact enters flow', config: { source: 'Contact list upload' } },
  },
]

export default async function CampaignFlowPage({
  params,
}: {
  params: Promise<{ flowId: string }>
}) {
  const { flowId } = await params
  const supabase = createServiceRoleClient()
  const { data: row } = await supabase.from('campaign_flows').select('*').eq('flow_id', flowId).single()

  const flow: CampaignFlowSummary = row
    ? {
        flowId: row.flow_id,
        name: row.name,
        description: row.description ?? '',
        status: row.status,
        agentId: row.agent_id ?? undefined,
        n8nWorkflowId: row.n8n_workflow_id ?? undefined,
        updatedAt: row.updated_at,
      }
    : { flowId, name: 'Untitled flow', description: '', status: 'draft', updatedAt: new Date().toISOString() }

  const nodes: Node<FlowNodeData>[] = row?.graph?.nodes?.length ? row.graph.nodes : FALLBACK_NODES
  const edges: Edge[] = row?.graph?.edges ?? []

  return <CampaignFlowBuilder flow={flow} initialNodes={nodes} initialEdges={edges} />
}
