'use client'

import { useParams } from 'next/navigation'
import AgentErrorMonitoring from '@/components/agents/AgentErrorMonitoring'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { Loader2 } from 'lucide-react'

export default function AgentMonitoringPage() {
  const params = useParams()
  const agentId = Array.isArray(params?.agentid) ? params.agentid[0] : params.agentid

  // Fetch agent details
  const { data: agents, isLoading } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name',
    filters: [{ column: 'id', operator: 'eq', value: agentId }]
  })

  const agent = agents?.[0]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Agent not found</p>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-auto p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Error Monitoring
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time error tracking for {agent.name}
          </p>
        </div>
        
        <AgentErrorMonitoring 
          agentId={agent.id} 
          agentName={agent.name || 'Agent'} 
        />
      </div>
    </div>
  )
}


