import { CampaignFlowBuilder } from '@/components/campaignFlows/campaign-flow-builder'

export default function CreateCampaignFlowPage() {
  return (
    <CampaignFlowBuilder
      flow={{
        flowId: 'new',
        name: 'Untitled campaign flow',
        description: 'Give this a name once you start editing.',
        status: 'draft',
        updatedAt: new Date().toISOString(),
      }}
      initialNodes={[
        {
          id: 'trigger',
          type: 'flow',
          position: { x: 0, y: 0 },
          data: { kind: 'trigger', title: 'Contact enters flow', config: { source: 'Contact list upload' } },
        },
      ]}
      initialEdges={[]}
    />
  )
}
