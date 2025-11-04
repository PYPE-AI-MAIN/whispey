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

// Helper function to get agent running status (copied from AgentListItem)
const getAgentRunningStatus = (agent: Agent, runningAgents?: RunningAgent[], isLoading?: boolean) => {
  if (agent.agent_type !== 'pype_agent') {
    return null
  }
  if (isLoading) {
    return { isRunning: false, pid: null, status: 'loading' }
  }
  if (!runningAgents) {
    return { isRunning: false, pid: null, status: 'stopped' }
  }
  const sanitizedAgentId = agent.id.replace(/-/g, '_')
  const newFormat = `${agent.name}_${sanitizedAgentId}`
  let runningAgent = runningAgents.find(ra => ra.agent_name === newFormat)
  if (!runningAgent) {
    runningAgent = runningAgents.find(ra => ra.agent_name === agent.name)
  }
  return runningAgent ? {
    isRunning: true,
    pid: runningAgent.pid,
    status: runningAgent.status,
    actualAgentName: runningAgent.agent_name
  } : {
    isRunning: false,
    pid: null,
    status: 'stopped'
  }
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
  const [isStartingAgent, setIsStartingAgent] = useState<string | null>(null) // Will hold agent.id
  const [isStoppingAgent, setIsStoppingAgent] = useState<string | null>(null) // Will hold actual_agent_name

  const hasPypeAgents = agents.some(agent => agent.agent_type === 'pype_agent')

  const { data: runningAgents = [], isLoading: isLoadingRunningAgents, refetch: refetchRunningAgents } = useQuery<RunningAgent[]>({ // Explicitly type useQuery
    queryKey: ['runningAgents', projectId],
    queryFn: async () => {
      const response = await fetch('/api/agents/running_agents')
      if (!response.ok) return []
      const data = await response.json()
      return data || []
    },
    enabled: hasPypeAgents,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    gcTime: 0, // Changed from cacheTime
  })

  // Smart start agent handler
  const handleStartAgent = async (agent: Agent) => {
    setIsStartingAgent(agent.id)
    
    const sanitizedAgentId = agent.id.replace(/-/g, '_')
    const newFormatName = `${agent.name}_${sanitizedAgentId}`
    const legacyName = agent.name

    const attemptStart = async (nameToTry: string) => {
      return await fetch('/api/agents/start_agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_name: nameToTry })
      })
    }

    try {
      let response = await attemptStart(newFormatName)

      if (response.status === 404) {
        console.warn(`Start failed for ${newFormatName}, trying legacy name: ${legacyName}`)
        response = await attemptStart(legacyName)
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(`Failed to start agent ${agent.name}:`, errorData.detail || 'Unknown error')
      }

    } catch (error) {
      console.error('Error starting agent:', error)
    } finally {
      // Refetch and then disable loading state
      setTimeout(async () => {
        await refetchRunningAgents()
        setIsStartingAgent(null)
      }, 2000) // Wait for agent to fully start
    }
  }

  // Stop agent handler
  const handleStopAgent = async (agentName: string) => {
    setIsStoppingAgent(agentName)
    try {
      const response = await fetch('/api/agents/stop_agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_name: agentName })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(`Failed to stop agent ${agentName}:`, errorData.detail || 'Unknown error')
      }

    } catch (error) {
      console.error('Error stopping agent:', error)
    } finally {
      // Refetch and then disable loading state
      setTimeout(async () => {
        await refetchRunningAgents()
        setIsStoppingAgent(null)
      }, 1000) // Wait for agent to fully stop
    }
  }

  const renderAgentItem = (agent: Agent, index: number, currentViewMode: 'grid' | 'list' | 'mobile') => {
    const runningStatus = getAgentRunningStatus(agent, runningAgents, isLoadingRunningAgents)
    return (
      <AgentListItem
        key={agent.id}
        agent={agent}
        viewMode={currentViewMode}
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
        isStartingAgent={isStartingAgent === agent.id}
        isStoppingAgent={isStoppingAgent === runningStatus?.actualAgentName}
        isMobile={currentViewMode === 'mobile'}
      />
    )
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {agents.map((agent, index) => renderAgentItem(agent, index, 'mobile'))}
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        {agents.map((agent, index) => renderAgentItem(agent, index, 'list'))}
      </div>
    )
  }

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent, index) => renderAgentItem(agent, index, 'grid'))}
    </div>
  )
}

export default AgentList