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
        setTimeout(fetchRunningAgents, 2000)
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
        setTimeout(fetchRunningAgents, 1000)
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
    runningAgents.some(ra => ra.agent_name === agent.name)
  )

  // Fetch running agents status
  const fetchRunningAgents = async () => {
    try {
      setIsLoadingStatus(true)
      const response = await fetch('/api/agents/running_agents')
      if (response.ok) {
        const data = await response.json()
        setRunningAgents(data || [])
      } else {
        setRunningAgents([])
      }
    } catch (error) {
      setRunningAgents([])
    } finally {
      setIsLoadingStatus(false)
    }
  }

  // Fetch running status on component mount and set up polling
  useEffect(() => {
    fetchRunningAgents()
    const interval = setInterval(fetchRunningAgents, 15000)
    return () => clearInterval(interval)
  }, [])

  // Also refetch when agents list changes
  useEffect(() => {
    const hasPypeAgents = agents.some(agent => agent.agent_type === 'pype_agent')
    if (hasPypeAgents) {
      fetchRunningAgents()
    }
  }, [agents])

  // Mobile-first approach: always use optimized list view on mobile
  if (isMobile) {
    return (
      <div className="space-y-3">
        {/* Mobile loading indicator */}
        {isLoadingStatus && agents.some(agent => agent.agent_type === 'pype_agent') && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Checking agent status...</span>
            </div>
          </div>
        )}
        
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
        {isLoadingStatus && agents.some(agent => agent.agent_type === 'pype_agent') && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <div className="w-4 h-4 border border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin"></div>
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
            isMobile={false}
          />
        ))}
      </div>
    )
  }

  // Desktop grid view
  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      {isLoadingStatus && agents.some(agent => agent.agent_type === 'pype_agent') && (
        <div className="col-span-full">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <div className="w-4 h-4 border border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin"></div>
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
          isMobile={false}
        />
      ))}
    </div>
  )
}

export default AgentList