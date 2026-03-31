'use client'

import React from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ConfigPage() {
  const params = useParams()
  const router = useRouter()
  const agentid = Array.isArray(params.agentid) ? params.agentid[0] : params.agentid || ''
  const projectId = Array.isArray(params.projectid) ? params.projectid[0] : params.projectid || ''

  const { data: agentDataResponse, isLoading } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, configuration',
    filters: [{ column: 'id', operator: 'eq', value: agentid }],
    limit: 1,
    auth: agentid ? { agentId: agentid } : undefined,
  })

  useEffect(() => {
    if (isLoading || !agentDataResponse) return
    const agent = agentDataResponse[0]
    const pipecatAgentId = agent?.configuration?.pipecat_agent_id
    if (pipecatAgentId) {
      router.replace(`/${projectId}/agents/${agentid}/config/pipecat`)
    } else {
      router.replace(`/${projectId}/agents/${agentid}/config/livekit`)
    }
  }, [isLoading, agentDataResponse, projectId, agentid, router])

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-64"></div>
        <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded"></div>
      </div>
    </div>
  )
}