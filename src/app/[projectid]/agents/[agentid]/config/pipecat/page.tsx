// src/app/[projectid]/agents/[agentid]/config/pipecat/page.tsx
'use client'

import { useParams } from 'next/navigation'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import PipecatAgentConfig from '@/components/agents/AgentConfig/Pipecat/PipecatAgentConfig'

export default function PipecatConfigPage() {
  const params = useParams()
  const agentid = Array.isArray(params.agentid) ? params.agentid[0] : params.agentid || ''
  const projectId = Array.isArray(params.projectid) ? params.projectid[0] : params.projectid || ''

  const { data: agentDataResponse, isLoading } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, configuration',
    filters: [{ column: 'id', operator: 'eq', value: agentid }],
    limit: 1,
    auth: agentid ? { agentId: agentid } : undefined,
  })

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-64"></div>
          <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded"></div>
        </div>
      </div>
    )
  }

  const agent = agentDataResponse?.[0]
  const pipecatAgentId = agent?.configuration?.pipecat_agent_id

  if (!pipecatAgentId) {
    return <div className="p-6 text-red-500">Pipecat agent ID not found in configuration.</div>
  }

  return (
    <PipecatAgentConfig
      agentId={agentid}
      projectId={projectId}
      pipecatAgentId={pipecatAgentId}
      agentName={agent?.name || ''}
    />
  )
}