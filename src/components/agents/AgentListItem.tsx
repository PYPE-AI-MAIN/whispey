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
  Loader2,
  ChevronRight
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
  viewMode: 'grid' | 'list' | 'mobile'
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
      return <Activity className="w-4 h-4" />
    case 'vapi':
      return <Eye className="w-4 h-4" />
    default:
      return <Bot className="w-4 h-4" />
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
    return null
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
const getStatusIndicator = (agent: Agent, runningAgents?: RunningAgent[], size: 'sm' | 'md' = 'sm') => {
  const runningStatus = getAgentRunningStatus(agent, runningAgents)
  const dotSize = size === 'md' ? 'w-3 h-3' : 'w-2 h-2'
  
  if (!runningStatus) {
    return (
      <div className={`${dotSize} rounded-full border border-white dark:border-gray-900 bg-gray-300 dark:bg-gray-600`}></div>
    )
  }
  
  return (
    <div className={`${dotSize} rounded-full border border-white dark:border-gray-900 ${
      runningStatus.isRunning ? 'bg-green-500' : 'bg-red-500'
    }`}></div>
  )
}

// Helper function to get status text
const getStatusText = (agent: Agent, runningAgents?: RunningAgent[]) => {
  const runningStatus = getAgentRunningStatus(agent, runningAgents)
  
  if (!runningStatus) {
    return 'Monitoring'
  }
  
  return runningStatus.isRunning ? 'Running' : 'Stopped'
}

// Helper function to get status color
const getStatusColor = (agent: Agent, runningAgents?: RunningAgent[]) => {
  const runningStatus = getAgentRunningStatus(agent, runningAgents)
  
  if (!runningStatus) {
    return 'text-gray-500 dark:text-gray-400'
  }
  
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
    e.preventDefault()
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

  // Mobile-optimized view
  if (viewMode === 'mobile') {
    return (
      <Link href={`/${projectId}/agents/${agent.id}`} className="block">
        <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all duration-150 ${
          isSelected ? 'ring-2 ring-blue-500 border-blue-300 dark:ring-blue-400 dark:border-blue-600' : ''
        }`}>
          {/* Header with icon, name, and chevron */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
                {getAgentTypeIcon(agent.agent_type)}
              </div>
              <div className="absolute -bottom-1 -right-1">
                {getStatusIndicator(agent, runningAgents, 'md')}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">
                  {agent.name}
                </h3>
                {agent.agent_type === 'pype_agent' && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5 h-6">
                    Pype
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                {agent.agent_type === 'livekit' ? 'LiveKit Agent' : 
                 agent.agent_type === 'pype_agent' ? 'Pype Agent' :
                 agent.agent_type === 'vapi' ? 'Vapi Agent' : `${agent.agent_type} Agent`}
              </p>
            </div>
            
            <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          </div>

          {/* Status and environment row */}
          <div className="flex items-center justify-between mb-4">
            <span className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full ${getEnvironmentBadgeColor(agent.environment)}`}>
              {agent.environment}
            </span>
            
            <div className={`text-sm font-medium flex items-center gap-2 ${getStatusColor(agent, runningAgents)}`}>
              {agent.agent_type === 'pype_agent' && runningStatus && (
                <>
                  {isStartingAgent ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isStoppingAgent ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : runningStatus.isRunning ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </>
              )}
              <span>
                {isStartingAgent ? 'Starting...' : isStoppingAgent ? 'Stopping...' : getStatusText(agent, runningAgents)}
              </span>
            </div>
          </div>

          {/* Agent ID section */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Agent ID</div>
                <code className="text-sm text-gray-700 dark:text-gray-300 font-mono block truncate">
                  {agent.id}
                </code>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onCopyId(e)
                }}
                className="ml-2 w-10 h-10 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            
            {isCopied && (
              <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                ✓ Copied to clipboard
              </div>
            )}
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Created {formatDate(agent.created_at, true)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Quick actions for Pype agents */}
              {agent.agent_type === 'pype_agent' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartStop}
                  disabled={isStartingAgent || isStoppingAgent}
                  className="h-9 px-4 text-sm"
                >
                  {isStartingAgent || isStoppingAgent ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : runningStatus?.isRunning ? (
                    <Square className="w-4 h-4 mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {isStartingAgent ? 'Starting' : isStoppingAgent ? 'Stopping' : 
                   runningStatus?.isRunning ? 'Stop' : 'Start'}
                </Button>
              )}
              
              {/* More options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-9 h-9 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                  }} className="text-sm py-3">
                    <Eye className="h-4 w-4 mr-3" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                  }} className="text-sm py-3">
                    <BarChart3 className="h-4 w-4 mr-3" />
                    Analytics
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                  }} className="text-sm py-3">
                    <Settings className="h-4 w-4 mr-3" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDelete()
                  }} className="text-red-600 dark:text-red-400 text-sm py-3">
                    <Trash2 className="h-4 w-4 mr-3" />
                    Remove Agent
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Show PID for running agents */}
          {!isStartingAgent && !isStoppingAgent && runningStatus?.isRunning && runningStatus.pid && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium">Process ID:</span> {runningStatus.pid}
              </div>
            </div>
          )}
        </div>
      </Link>
    )
  }

  // Desktop list view
  if (viewMode === 'list') {
    return (
      <Link href={`/${projectId}/agents/${agent.id}`} className="block">
        <div
          className={`group px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800 ${
            isLastItem ? '' : 'border-b'
          } ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
        >
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 relative">
              {getAgentTypeIcon(agent.agent_type)}
              <div className="absolute -bottom-0.5 -right-0.5">
                {getStatusIndicator(agent, runningAgents)}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {agent.name}
                  </h3>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${getEnvironmentBadgeColor(agent.environment)}`}>
                    {agent.environment}
                  </span>
                  {agent.agent_type === 'pype_agent' && (
                    <Badge variant="outline" className="text-xs px-2 py-0 h-5">
                      Pype
                    </Badge>
                  )}
                </div>
                <div className={`text-sm font-medium flex items-center gap-2 ${getStatusColor(agent, runningAgents)}`}>
                  {agent.agent_type === 'pype_agent' && runningStatus && (
                    <>
                      {isStartingAgent ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isStoppingAgent ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : runningStatus.isRunning ? (
                        <Play className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </>
                  )}
                  {isStartingAgent ? 'Starting...' : isStoppingAgent ? 'Stopping...' : getStatusText(agent, runningAgents)}
                  {!isStartingAgent && !isStoppingAgent && runningStatus?.isRunning && runningStatus.pid && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      (PID: {runningStatus.pid})
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs">ID: {agent.id.slice(0, 8)}...{agent.id.slice(-4)}</span>
                  <span className="text-xs">Created {formatDate(agent.created_at, isMobile)}</span>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {agent.agent_type === 'pype_agent' && (
                      <>
                        <DropdownMenuItem onClick={handleStartStop} className="text-sm">
                          {runningStatus?.isRunning ? (
                            <>
                              <Square className="h-4 w-4 mr-2" />
                              Stop Agent
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Start Agent
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analytics
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      onCopyId(e)
                    }} className="text-sm">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy ID
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                    }} className="text-red-600 dark:text-red-400 text-sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          
          {isCopied && (
            <div className="mt-2 ml-11">
              <p className="text-sm text-green-600 dark:text-green-400">✓ Copied!</p>
            </div>
          )}
        </div>
      </Link>
    )
  }

  // Desktop grid view
  return (
    <Link href={`/${projectId}/agents/${agent.id}`} className="block">
      <div
        className={`group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-md dark:hover:shadow-gray-900/20 cursor-pointer transition-all duration-200 ${
          isSelected ? 'ring-2 ring-blue-500 border-blue-300 dark:ring-blue-400 dark:border-blue-600' : 'hover:border-gray-300 dark:hover:border-gray-700'
        }`}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0 relative">
                {getAgentTypeIcon(agent.agent_type)}
                <div className="absolute -bottom-1 -right-1">
                  {getStatusIndicator(agent, runningAgents, 'md')}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{agent.name}</h3>
                  {agent.agent_type === 'pype_agent' && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5 h-5">
                      Pype
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {agent.agent_type === 'livekit' ? 'LiveKit Agent' : 
                   agent.agent_type === 'pype_agent' ? 'Pype Agent' :
                   agent.agent_type === 'vapi' ? 'Vapi Agent' : `${agent.agent_type} Agent`}
                </p>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 w-8 h-8 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {agent.agent_type === 'pype_agent' && (
                  <>
                    <DropdownMenuItem onClick={handleStartStop} className="text-sm">
                      {runningStatus?.isRunning ? (
                        <>
                          <Square className="h-4 w-4 mr-2" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  onCopyId(e)
                }} className="text-sm">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }} className="text-red-600 dark:text-red-400 text-sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Environment Badge */}
          <div className="mb-3">
            <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${getEnvironmentBadgeColor(agent.environment)}`}>
              {agent.environment}
            </span>
          </div>

          {/* Agent ID */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Agent ID</div>
                <code className="text-xs text-gray-700 dark:text-gray-300 font-mono block truncate">
                  {agent.id}
                </code>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onCopyId(e)
                }}
                className="w-7 h-7 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            {isCopied && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Copied!</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDate(agent.created_at, isMobile)}</span>
            </div>
            <div className={`font-medium flex items-center gap-1.5 ${getStatusColor(agent, runningAgents)}`}>
              {agent.agent_type === 'pype_agent' && runningStatus && (
                <>
                  {runningStatus.isRunning ? (
                    <Play className="w-3.5 h-3.5" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </>
              )}
              {getStatusText(agent, runningAgents)}
            </div>
          </div>

          {/* Show PID for running Pype agents */}
          {runningStatus?.isRunning && runningStatus.pid && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
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