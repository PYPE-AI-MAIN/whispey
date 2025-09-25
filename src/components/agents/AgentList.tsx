import React, { useState, useEffect } from 'react'
import AgentListItem from './AgentListItem'
import { useMobile } from '@/hooks/use-mobile'

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
  showRunningCounter?: boolean // Add this prop to control showing counter
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
  const [runningAgents, setRunningAgents] = useState<RunningAgent[]>([])
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [isStartingAgent, setIsStartingAgent] = useState<string | null>(null)
  const [isStoppingAgent, setIsStoppingAgent] = useState<string | null>(null)

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
        console.log('Agent started:', data)
        // Refetch running agents to update status
        setTimeout(fetchRunningAgents, 2000) // Wait 2s for agent to start
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to start agent:', errorData.error)
        // You might want to show a toast notification here
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
        console.log('Agent stopped:', data)
        // Refetch running agents to update status
        setTimeout(fetchRunningAgents, 1000) // Wait 1s for agent to stop
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to stop agent:', errorData.error)
        // You might want to show a toast notification here
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
    runningAgents.some(ra => ra.agent_name === agent.name)
  )

  // Force list view on mobile for better UX
  const effectiveViewMode = isMobile ? 'list' : viewMode

  // Fetch running agents status
  const fetchRunningAgents = async () => {
    try {
      setIsLoadingStatus(true)
      const response = await fetch('/api/agents/running_agents')
      if (response.ok) {
        const data = await response.json()
        setRunningAgents(data || [])
        console.log('Fetched running agents:', data)
      } else {
        console.error('Failed to fetch running agents:', response.status)
        setRunningAgents([])
      }
    } catch (error) {
      console.error('Error fetching running agents:', error)
      setRunningAgents([])
    } finally {
      setIsLoadingStatus(false)
    }
  }

  // Fetch running status on component mount and set up polling
  useEffect(() => {
    fetchRunningAgents()

    // Poll every 15 seconds to keep status updated
    const interval = setInterval(fetchRunningAgents, 15000)

    return () => clearInterval(interval)
  }, [])

  // Also refetch when agents list changes (in case new Pype agents are added)
  useEffect(() => {
    const hasPypeAgents = agents.some(agent => agent.agent_type === 'pype_agent')
    if (hasPypeAgents) {
      fetchRunningAgents()
    }
  }, [agents])

  if (effectiveViewMode === 'list') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        {/* Optional: Show loading indicator for status */}
        {isLoadingStatus && agents.some(agent => agent.agent_type === 'pype_agent') && (
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <div className="w-3 h-3 border border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin"></div>
              Checking agent status...
            </div>
          </div>
        )}
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
            onCopyId={(e) => onCopyAgentId(agent.id, e)}
            onDelete={() => onDeleteAgent(agent)}
            onStartAgent={handleStartAgent}
            onStopAgent={handleStopAgent}
            isStartingAgent={isStartingAgent === agent.name}
            isStoppingAgent={isStoppingAgent === agent.name}
            isMobile={isMobile}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`grid gap-4 ${
      isMobile 
        ? 'grid-cols-1' 
        : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
    }`}>
      {/* Optional: Show loading indicator for status in grid view */}
      {isLoadingStatus && agents.some(agent => agent.agent_type === 'pype_agent') && (
        <div className="col-span-full">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <div className="w-3 h-3 border border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin"></div>
              Checking Pype agent status...
            </div>
          </div>
        </div>
      )}
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
          onCopyId={(e) => onCopyAgentId(agent.id, e)}
          onDelete={() => onDeleteAgent(agent)}
          onStartAgent={handleStartAgent}
          onStopAgent={handleStopAgent}
          isStartingAgent={isStartingAgent === agent.name}
          isStoppingAgent={isStoppingAgent === agent.name}
          isMobile={isMobile}
        />
      ))}
    </div>
  )
}

export default AgentList