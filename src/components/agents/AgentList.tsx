import React, { useEffect, useState } from 'react'
import AgentListItem from './AgentListItem'
import { useMobile } from '@/hooks/use-mobile'
import { useQuery } from '@tanstack/react-query'

type MonitoringRegistrationState = 'unknown' | 'registered' | 'missing'

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

const deriveMonitoringEnabled = (agent: Agent): boolean | null => {
  const config = agent.configuration || {}

  if (typeof config.monitoringEnabled === 'boolean') {
    return config.monitoringEnabled
  }

  if (typeof config.monitoring_enabled === 'boolean') {
    return config.monitoring_enabled
  }

  if (config.monitoring && typeof config.monitoring.enabled === 'boolean') {
    return config.monitoring.enabled
  }

  return null
}

const extractMonitoringEnabledFromApi = (payload: any): boolean | null => {
  if (!payload) return null

  if (typeof payload.monitoringEnabled === 'boolean') {
    return payload.monitoringEnabled
  }

  if (payload.data?.agent && typeof payload.data.agent.monitoringEnabled === 'boolean') {
    return payload.data.agent.monitoringEnabled
  }

  if (payload.agent && typeof payload.agent.monitoringEnabled === 'boolean') {
    return payload.agent.monitoringEnabled
  }

  return null
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
  const [monitoringStates, setMonitoringStates] = useState<Record<string, boolean>>({})
  const [monitoringLoading, setMonitoringLoading] = useState<Record<string, boolean>>({})
  const [monitoringRegistrationStates, setMonitoringRegistrationStates] = useState<
    Record<string, MonitoringRegistrationState>
  >({})

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

  const monitoringServiceBaseUrl = process.env.NEXT_PUBLIC_MONITORING_SERVICE_BASE_URL
  const monitoringAgentBaseUrl =
    process.env.NEXT_PUBLIC_MONITORING_AGENT_BASE_URL ||
    process.env.NEXT_PUBLIC_PYPEAI_API_URL ||
    ''

  useEffect(() => {
    setMonitoringStates(prev => {
      const next = { ...prev }
      let hasChanges = false

      agents.forEach(agent => {
        const derived = deriveMonitoringEnabled(agent)
        const existing = next[agent.id]

        if (derived === null && existing === undefined) {
          next[agent.id] = false
          hasChanges = true
        } else if (derived !== null && existing !== derived) {
          next[agent.id] = derived
          hasChanges = true
        }
      })

      return hasChanges ? next : prev
    })
  }, [agents])

  useEffect(() => {
    if (!monitoringServiceBaseUrl || agents.length === 0) {
      return
    }

    let isCancelled = false

    const fetchStates = async () => {
      const nextStates: Record<string, boolean> = {}

      await Promise.all(
        agents.map(async (agent) => {
          try {
            const response = await fetch(`${monitoringServiceBaseUrl}/agents/${agent.id}`)
            if (!response.ok) {
              if (response.status === 404) {
                setMonitoringRegistrationStates((prev) => ({ ...prev, [agent.id]: 'missing' }))
              }
              return
            }
            const payload = await response.json().catch(() => null)
            const enabled = extractMonitoringEnabledFromApi(payload)
            if (typeof enabled === 'boolean') {
              nextStates[agent.id] = enabled
              setMonitoringRegistrationStates((prev) => ({ ...prev, [agent.id]: 'registered' }))
            }
          } catch (error) {
            console.warn('Failed to fetch monitoring state for agent', agent.id, error)
          }
        })
      )

      if (!isCancelled && Object.keys(nextStates).length > 0) {
        setMonitoringStates((prev) => ({ ...prev, ...nextStates }))
      }
    }

    fetchStates()

    return () => {
      isCancelled = true
    }
  }, [agents, monitoringServiceBaseUrl])

  const handleToggleMonitoring = async (agent: Agent, shouldEnable: boolean) => {
    if (!monitoringServiceBaseUrl) {
      console.error('NEXT_PUBLIC_MONITORING_SERVICE_BASE_URL is not configured.')
      if (typeof window !== 'undefined') {
        alert('Monitoring service URL is not configured. Please set NEXT_PUBLIC_MONITORING_SERVICE_BASE_URL.')
      }
      return
    }

    if (shouldEnable && !agent.is_active) {
      return
    }

    const previousValue = monitoringStates[agent.id] ?? false
    const registrationState = monitoringRegistrationStates[agent.id] ?? 'unknown'
    setMonitoringLoading(prev => ({ ...prev, [agent.id]: true }))

    const toggleRequest = async (enabledValue: boolean) => {
      const response = await fetch(`${monitoringServiceBaseUrl}/agents/${agent.id}/monitoring`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enabledValue })
      })
      return response
    }

    const ensureResponseOk = async (response: Response, desiredEnabled: boolean) => {
      if (!response.ok) {
        if (response.status === 404) {
          setMonitoringRegistrationStates(prev => ({ ...prev, [agent.id]: 'missing' }))
        }
        const errorText = await response.text()
        throw new Error(
          errorText || `Failed to ${desiredEnabled ? 'enable' : 'disable'} monitoring for ${agent.name}`
        )
      }
      return response
    }

    try {
      let response: Response

      if (shouldEnable) {
        const shouldRegisterFirst = registrationState !== 'registered'
        if (shouldRegisterFirst) {
          const payload = {
            agentId: agent.id,
            name: agent.name,
            baseUrl: monitoringAgentBaseUrl,
            description: agent.configuration?.description || 'Voice assistant agent',
            tags: Array.isArray(agent.configuration?.tags) ? agent.configuration?.tags : ['voice'],
            metadata: {
              version: agent.configuration?.metadata?.version || agent.configuration?.version || '1.0.0',
              owner: agent.configuration?.metadata?.owner || agent.configuration?.owner || 'prod',
              environment: agent.environment
            }
          }

          const registerResponse = await fetch(`${monitoringServiceBaseUrl}/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })

          if (!registerResponse.ok) {
            const errorText = await registerResponse.text()
            console.warn('Monitoring registration failed, attempting toggle fallback:', errorText)
            const fallbackResponse = await toggleRequest(true)
            response = await ensureResponseOk(fallbackResponse, true)
          } else {
            response = registerResponse
            setMonitoringRegistrationStates(prev => ({ ...prev, [agent.id]: 'registered' }))
          }
        } else {
          const toggleResponse = await toggleRequest(true)
          response = await ensureResponseOk(toggleResponse, true)
          setMonitoringRegistrationStates(prev => ({ ...prev, [agent.id]: 'registered' }))
        }
      } else {
        const toggleResponse = await toggleRequest(false)
        response = await ensureResponseOk(toggleResponse, false)
      }

      const responsePayload = await response.json().catch(() => null)
      const derivedFromResponse = extractMonitoringEnabledFromApi(responsePayload)
      const nextValue =
        typeof derivedFromResponse === 'boolean' ? derivedFromResponse : (shouldEnable ? true : false)

      if (shouldEnable) {
        setMonitoringRegistrationStates(prev => ({ ...prev, [agent.id]: 'registered' }))
      }

      setMonitoringStates(prev => ({ ...prev, [agent.id]: nextValue }))
    } catch (error) {
      console.error('Failed to toggle monitoring', error)
      if (typeof window !== 'undefined') {
        alert(
          `Failed to ${shouldEnable ? 'enable' : 'disable'} monitoring for ${agent.name}. ${
            error instanceof Error ? error.message : ''
          }`
        )
      }
      setMonitoringStates(prev => ({ ...prev, [agent.id]: previousValue }))
    } finally {
      setMonitoringLoading(prev => ({ ...prev, [agent.id]: false }))
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
        monitoringEnabled={monitoringStates[agent.id] ?? false}
        monitoringToggleLoading={Boolean(monitoringLoading[agent.id])}
        onToggleMonitoring={handleToggleMonitoring}
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