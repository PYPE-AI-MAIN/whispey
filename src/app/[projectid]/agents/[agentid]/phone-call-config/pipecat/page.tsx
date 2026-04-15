// src/app/[projectid]/agents/[agentid]/phone-call-config/pipecat/page.tsx
'use client'

import { useParams } from 'next/navigation'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { Loader2 } from 'lucide-react'
import PipecatPhoneCallConfig from '@/components/agents/PipecatPhoneCallConfig'

export default function PipecatPhoneCallConfigPage() {
  const params = useParams()
  const agentId = Array.isArray(params.agentid) ? params.agentid[0] : params.agentid || ''
  const projectId = Array.isArray(params.projectid) ? params.projectid[0] : params.projectid || ''

  const { data: agentDataResponse, isLoading } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, configuration',
    filters: [{ column: 'id', operator: 'eq', value: agentId }],
    limit: 1,
    auth: agentId ? { agentId } : undefined,
  })

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const agent = agentDataResponse?.[0]
  const pipecatAgentId = agent?.configuration?.pipecat_agent_id

  if (!pipecatAgentId) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <p className="text-sm text-red-500">Pipecat agent ID not found in configuration.</p>
      </div>
    )
  }

  return (
    <PipecatPhoneCallConfig
      agentId={agentId}
      projectId={projectId}
      pipecatAgentId={pipecatAgentId}
      agentName={agent?.name || ''}
    />
  )
}