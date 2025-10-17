import React, { useState } from 'react'
import AgentListItem from './AgentListItem'
import { useMobile } from '@/hooks/use-mobile'
import { useQuery } from '@tanstack/react-query'

interface Agent {
  id: string
  name: string
  agent_type: string
  configuration: any
  environment: string
  created_at: string
  is_active: boolean
  project_id: string
}

interface RunningAgent {
  agent_name: string
  pid: number
  status: string
}

interface AgentListProps {
  agents: Agent[]
  viewMode: 'grid' | 'list'
  selectedAgent: string | null
  copiedAgentId: string | null
  projectId: string
  onCopyAgentId: (agentId: string, e: React.MouseEvent) => void
  onDeleteAgent: (agent: Agent) => void
  showRunningCounter?: boolean
}

const AgentList: React.FC<AgentListProps> = ({
  agents,
  viewMode,
  selectedAgent,
  copiedAgentId,
  projectId,
  onCopyAgentId,
  onDeleteAgent,
  showRunningCounter = true
}) => {
  const { isMobile } = useMobile(768)
  const [isStartingAgent, setIsStartingAgent] = useState<string | null>(null)
  const [isStoppingAgent, setIsStoppingAgent] = useState<string | null>(null)

  // Check if there are any pype agents
  const hasPypeAgents = agents.some(agent => agent.agent_type === 'pype_agent')

  // Fetch running agents using React Query
  const { data: runningAgents = [], isLoading: isLoadingRunningAgents, refetch: refetchRunningAgents } = useQuery({
    queryKey: ['runningAgents', projectId],
    queryFn: async () => {
      const response = await fetch('/api/agents/running_agents')
      if (!response.ok) {
        return []
      }
      const data = await response.json()
      return data || []
    },
    enabled: hasPypeAgents, // Only fetch if there are pype agents
    // refetchInterval: 30000, // Refetch every 30 seconds
    // staleTime: 20000, // Consider data stale after 20 seconds
  })

  // Start agent handler
  const handleStartAgent = async (agentName: string) => {
    setIsStartingAgent(agentName)
    try {
      const response = await fetch('/api/agents/start_agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent_name: agentName })
      })

      if (response.ok) {
        const data = await response.json()
        // Refetch after 2 seconds to allow agent to start
        setTimeout(() => refetchRunningAgents(), 2000)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      }
    } catch (error) {
      console.error('Error starting agent:', error)
    } finally {
      setIsStartingAgent(null)
    }
  }

  // Stop agent handler
  const handleStopAgent = async (agentName: string) => {
    setIsStoppingAgent(agentName)
    try {
      const response = await fetch('/api/agents/stop_agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent_name: agentName })
      })

      if (response.ok) {
        const data = await response.json()
        // Refetch after 1 second to confirm agent stopped
        setTimeout(() => refetchRunningAgents(), 1000)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      }
    } catch (error) {
      console.error('Error stopping agent:', error)
    } finally {
      setIsStoppingAgent(null)
    }
  }

  // Calculate running agents stats
  const pypeAgents = agents.filter(agent => agent.agent_type === 'pype_agent')
  const runningPypeAgents = pypeAgents.filter(agent => 
    runningAgents.some((ra: RunningAgent) => {
      // Sanitize agent ID by replacing hyphens with underscores
      const sanitizedAgentId = agent.id.replace(/-/g, '_')
      
      // First try: Check with name_sanitizedAgentId format (new format)
      const newFormat = `${agent.name}_${sanitizedAgentId}`
      if (ra.agent_name === newFormat) {
        return true
      }
      
      // Second try: Check with just name (backward compatibility)
      if (ra.agent_name === agent.name) {
        return true
      }
      
      return false
    })
  )

  if (isMobile) {
    return (
      <div className="space-y-3">
        {agents.map((agent, index) => (
          <AgentListItem
            key={agent.id}
            agent={agent}
            viewMode="mobile"
            isSelected={selectedAgent === agent.id}
            isCopied={copiedAgentId === agent.id}
            isLastItem={index === agents.length - 1}
            projectId={projectId}
            runningAgents={runningAgents}
            isLoadingRunningAgents={isLoadingRunningAgents}
            onCopyId={(e) => onCopyAgentId(agent.id, e)}
            onDelete={() => onDeleteAgent(agent)}
            onStartAgent={handleStartAgent}
            onStopAgent={handleStopAgent}
            isStartingAgent={isStartingAgent === agent.name}
            isStoppingAgent={isStoppingAgent === agent.name}
            isMobile={true}
          />
        ))}
      </div>
    )
  }

  // Desktop view modes
  if (viewMode === 'list') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        {agents.map((agent, index) => (
          <AgentListItem
            key={agent.id}
            agent={agent}
            viewMode="list"
            isSelected={selectedAgent === agent.id}
            isCopied={copiedAgentId === agent.id}
            isLastItem={index === agents.length - 1}
            projectId={projectId}
            runningAgents={runningAgents}
            isLoadingRunningAgents={isLoadingRunningAgents}
            onCopyId={(e) => onCopyAgentId(agent.id, e)}
            onDelete={() => onDeleteAgent(agent)}
            onStartAgent={handleStartAgent}
            onStopAgent={handleStopAgent}
            isStartingAgent={isStartingAgent === agent.name}
            isStoppingAgent={isStoppingAgent === agent.name}
            isMobile={false}
          />
        ))}
      </div>
    )
  }

  // Desktop grid view
  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <AgentListItem
          key={agent.id}
          agent={agent}
          viewMode="grid"
          isSelected={selectedAgent === agent.id}
          isCopied={copiedAgentId === agent.id}
          isLastItem={false}
          projectId={projectId}
          runningAgents={runningAgents}
          isLoadingRunningAgents={isLoadingRunningAgents}
          onCopyId={(e) => onCopyAgentId(agent.id, e)}
          onDelete={() => onDeleteAgent(agent)}
          onStartAgent={handleStartAgent}
          onStopAgent={handleStopAgent}
          isStartingAgent={isStartingAgent === agent.name}
          isStoppingAgent={isStoppingAgent === agent.name}
          isMobile={false}
        />
      ))}
    </div>
  )
}

export default AgentList