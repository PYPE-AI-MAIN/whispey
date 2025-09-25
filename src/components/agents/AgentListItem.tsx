import React from 'react'
import Link from 'next/link'
import { 
  MoreHorizontal, 
  Copy, 
  Settings, 
  Clock, 
  BarChart3,
  Eye,
  Activity,
  Bot,
  Trash2,
  Play,
  Square,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'

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

interface AgentListItemProps {
  agent: Agent
  viewMode: 'grid' | 'list'
  isSelected: boolean
  isCopied: boolean
  isLastItem: boolean
  projectId: string
  runningAgents?: RunningAgent[]
  onCopyId: (e: React.MouseEvent) => void
  onDelete: () => void
  onStartAgent?: (agentName: string) => void
  onStopAgent?: (agentName: string) => void
  isStartingAgent?: boolean
  isStoppingAgent?: boolean
  isMobile?: boolean
}

const getAgentTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'livekit':
    case 'pype_agent':
      return <Activity className="w-3 h-3" />
    case 'vapi':
      return <Eye className="w-3 h-3" />
    default:
      return <Bot className="w-3 h-3" />
  }
}

const formatDate = (dateString: string, isMobile: boolean = false) => {
  const date = new Date(dateString)
  if (isMobile) {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })
  }
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
}

const getEnvironmentBadgeColor = (environment: string) => {
  switch (environment.toLowerCase()) {
    case 'production':
    case 'prod':
      return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
    case 'staging':
    case 'stage':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
    default:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
  }
}

// Helper function to get agent running status
const getAgentRunningStatus = (agent: Agent, runningAgents?: RunningAgent[]) => {
  if (agent.agent_type !== 'pype_agent' || !runningAgents) {
    return null // Not a Pype agent or no running data
  }
  
  const runningAgent = runningAgents.find(ra => ra.agent_name === agent.name)
  return runningAgent ? {
    isRunning: true,
    pid: runningAgent.pid,
    status: runningAgent.status
  } : {
    isRunning: false,
    pid: null,
    status: 'stopped'
  }
}

// Helper function to get status indicator
const getStatusIndicator = (agent: Agent, runningAgents?: RunningAgent[]) => {
  const runningStatus = getAgentRunningStatus(agent, runningAgents)
  
  if (!runningStatus) {
    // Not a Pype agent - show default gray indicator
    return (
      <div className="w-2 h-2 rounded-full border border-white dark:border-gray-900 bg-gray-300 dark:bg-gray-600"></div>
    )
  }
  
  // Pype agent - show running/stopped status
  return (
    <div className={`w-2 h-2 rounded-full border border-white dark:border-gray-900 ${
      runningStatus.isRunning ? 'bg-green-500' : 'bg-red-500'
    }`}></div>
  )
}

// Helper function to get status text
const getStatusText = (agent: Agent, runningAgents?: RunningAgent[]) => {
  const runningStatus = getAgentRunningStatus(agent, runningAgents)
  
  if (!runningStatus) {
    // Not a Pype agent - show generic status
    return 'Monitoring'
  }
  
  // Pype agent - show running/stopped status
  return runningStatus.isRunning ? 'Running' : 'Stopped'
}

// Helper function to get status color
const getStatusColor = (agent: Agent, runningAgents?: RunningAgent[]) => {
  const runningStatus = getAgentRunningStatus(agent, runningAgents)
  
  if (!runningStatus) {
    // Not a Pype agent - show gray color
    return 'text-gray-500 dark:text-gray-400'
  }
  
  // Pype agent - show running/stopped status
  return runningStatus.isRunning 
    ? 'text-green-600 dark:text-green-400' 
    : 'text-red-600 dark:text-red-400'
}

const AgentListItem: React.FC<AgentListItemProps> = ({
  agent,
  viewMode,
  isSelected,
  isCopied,
  isLastItem,
  projectId,
  runningAgents,
  onCopyId,
  onDelete,
  onStartAgent,
  onStopAgent,
  isStartingAgent,
  isStoppingAgent,
  isMobile = false
}) => {
  const runningStatus = getAgentRunningStatus(agent, runningAgents)

  // Handler for start/stop actions
  const handleStartStop = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (isStartingAgent || isStoppingAgent) {
      return
    }
    
    if (runningStatus?.isRunning) {
      onStopAgent?.(agent.name)
    } else {
      onStartAgent?.(agent.name)
    }
  }

  if (viewMode === 'list') {
    return (
      <Link href={`/${projectId}/agents/${agent.id}`} className="block">
        <div
          className={`group px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800 ${
            isLastItem ? '' : 'border-b'
          } ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
        >
          <div className="flex items-center gap-2.5">
            {/* Icon */}
            <div className="w-7 h-7 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center flex-shrink-0 relative">
              {getAgentTypeIcon(agent.agent_type)}
              <div className="absolute -bottom-0.5 -right-0.5">
                {getStatusIndicator(agent, runningAgents)}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                    {agent.name}
                  </h3>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getEnvironmentBadgeColor(agent.environment)}`}>
                    {agent.environment}
                  </span>
                  {/* Show agent type badge for Pype agents */}
                  {agent.agent_type === 'pype_agent' && (
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                      Pype
                    </Badge>
                  )}
                </div>
                <div className={`text-xs font-medium flex items-center gap-1 ${getStatusColor(agent, runningAgents)}`}>
                  {agent.agent_type === 'pype_agent' && runningStatus && (
                    <>
                      {isStartingAgent ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isStoppingAgent ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : runningStatus.isRunning ? (
                        <Play className="w-3 h-3" />
                      ) : (
                        <Square className="w-3 h-3" />
                      )}
                    </>
                  )}
                  {isStartingAgent ? 'Starting...' : isStoppingAgent ? 'Stopping...' : getStatusText(agent, runningAgents)}
                  {/* Show PID only when running and not loading */}
                  {!isStartingAgent && !isStoppingAgent && runningStatus?.isRunning && runningStatus.pid && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      (PID: {runningStatus.pid})
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="font-mono">ID: {agent.id.slice(0, 6)}...{agent.id.slice(-3)}</span>
                  <span>Started {formatDate(agent.created_at, isMobile)}</span>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {/* Start/Stop for Pype agents only */}
                    {agent.agent_type === 'pype_agent' && (
                      <>
                        <DropdownMenuItem onClick={handleStartStop} className="text-xs">
                          {runningStatus?.isRunning ? (
                            <>
                              <Square className="h-3 w-3 mr-2" />
                              Stop Agent
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-2" />
                              Start Agent
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-xs">
                      <Eye className="h-3 w-3 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-xs">
                      <BarChart3 className="h-3 w-3 mr-2" />
                      Analytics
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-xs">
                      <Settings className="h-3 w-3 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      onCopyId(e)
                    }} className="text-xs">
                      <Copy className="h-3 w-3 mr-2" />
                      Copy ID
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                    }} className="text-red-600 dark:text-red-400 text-xs">
                      <Trash2 className="h-3 w-3 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          
          {/* Copy feedback */}
          {isCopied && (
            <div className="mt-1 ml-9">
              <p className="text-xs text-green-600 dark:text-green-400">Copied!</p>
            </div>
          )}
        </div>
      </Link>
    )
  }

  // Grid view
  return (
    <Link href={`/${projectId}/agents/${agent.id}`} className="block">
      <div
        className={`group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-sm dark:hover:shadow-gray-900/20 cursor-pointer transition-all duration-200 ${
          isSelected ? 'ring-1 ring-blue-500 border-blue-300 dark:ring-blue-400 dark:border-blue-600' : 'hover:border-gray-300 dark:hover:border-gray-700'
        }`}
      >
        <div className="p-3">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center flex-shrink-0 relative">
                {getAgentTypeIcon(agent.agent_type)}
                <div className="absolute -bottom-0.5 -right-0.5">
                  {getStatusIndicator(agent, runningAgents)}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 mb-1">
                  <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{agent.name}</h3>
                  {agent.agent_type === 'pype_agent' && (
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                      Pype
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {agent.agent_type === 'livekit' ? 'LiveKit' : 
                   agent.agent_type === 'pype_agent' ? 'Pype Agent' :
                   agent.agent_type === 'vapi' ? 'Vapi' : agent.agent_type}
                </p>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                {/* Start/Stop for Pype agents only */}
                {agent.agent_type === 'pype_agent' && (
                  <>
                    <DropdownMenuItem onClick={handleStartStop} className="text-xs">
                      {runningStatus?.isRunning ? (
                        <>
                          <Square className="h-3 w-3 mr-2" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-2" />
                          Start
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-xs">
                  <Eye className="h-3 w-3 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-xs">
                  <Settings className="h-3 w-3 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  onCopyId(e)
                }} className="text-xs">
                  <Copy className="h-3 w-3 mr-2" />
                  Copy ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }} className="text-red-600 dark:text-red-400 text-xs">
                  <Trash2 className="h-3 w-3 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Environment Badge */}
          <div className="mb-2">
            <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded ${getEnvironmentBadgeColor(agent.environment)}`}>
              {agent.environment}
            </span>
          </div>

          {/* Monitoring ID */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 mb-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">ID</div>
                <code className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                  {agent.id.slice(0, 6)}...{agent.id.slice(-3)}
                </code>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={onCopyId}
                className="w-5 h-5 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <Copy className="w-2.5 h-2.5" />
              </Button>
            </div>
            {isCopied && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Copied!</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              <span>{formatDate(agent.created_at, isMobile)}</span>
            </div>
            <div className={`font-medium flex items-center gap-1 ${getStatusColor(agent, runningAgents)}`}>
              {agent.agent_type === 'pype_agent' && runningStatus && (
                <>
                  {runningStatus.isRunning ? (
                    <Play className="w-3 h-3" />
                  ) : (
                    <Square className="w-3 h-3" />
                  )}
                </>
              )}
              {getStatusText(agent, runningAgents)}
            </div>
          </div>

          {/* Show PID for running Pype agents in grid view */}
          {runningStatus?.isRunning && runningStatus.pid && (
            <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                PID: {runningStatus.pid}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default AgentListItem