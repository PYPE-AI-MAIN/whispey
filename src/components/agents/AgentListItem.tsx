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
  Trash2
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

interface AgentListItemProps {
  agent: Agent
  viewMode: 'grid' | 'list'
  isSelected: boolean
  isCopied: boolean
  isLastItem: boolean
  projectId: string
  onCopyId: (e: React.MouseEvent) => void
  onDelete: () => void
}

const getAgentTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'livekit':
      return <Activity className="w-3.5 h-3.5" />
    case 'vapi':
      return <Eye className="w-3.5 h-3.5" />
    default:
      return <Bot className="w-3.5 h-3.5" />
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
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

const AgentListItem: React.FC<AgentListItemProps> = ({
  agent,
  viewMode,
  isSelected,
  isCopied,
  isLastItem,
  projectId,
  onCopyId,
  onDelete
}) => {
  if (viewMode === 'list') {
    return (
      <Link href={`/${projectId}/agents/${agent.id}`} className="block">
        <div
          className={`group px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800 ${
            isLastItem ? '' : 'border-b'
          } ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
        >
          <div className="flex items-center justify-between">
            {/* Left: Agent Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                {getAgentTypeIcon(agent.agent_type)}
                <div className={`absolute w-2.5 h-2.5 rounded-full border border-white dark:border-gray-900 -bottom-0.5 -right-0.5 ${
                  agent.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}></div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 mb-0.5">
                  <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{agent.name}</h3>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {agent.agent_type === 'livekit' ? 'LiveKit' : agent.agent_type === 'vapi' ? 'Vapi' : agent.agent_type}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${getEnvironmentBadgeColor(agent.environment)}`}>
                    {agent.environment}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>ID: {agent.id.slice(0, 8)}...{agent.id.slice(-4)}</span>
                  <span>Started {formatDate(agent.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Right: Status & Actions */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className={`text-xs font-medium ${agent.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {agent.is_active ? 'Monitoring' : 'Paused'}
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-xs">
                    <Eye className="h-3.5 w-3.5 mr-2.5 text-gray-500 dark:text-gray-400" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-xs">
                    <BarChart3 className="h-3.5 w-3.5 mr-2.5 text-gray-500 dark:text-gray-400" />
                    Analytics
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-xs">
                    <Settings className="h-3.5 w-3.5 mr-2.5 text-gray-500 dark:text-gray-400" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    onCopyId(e)
                  }} className="text-xs">
                    <Copy className="h-3.5 w-3.5 mr-2.5 text-gray-500 dark:text-gray-400" />
                    Copy Monitoring ID
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 text-xs">
                    <Trash2 className="h-3.5 w-3.5 mr-2.5" />
                    Remove Monitoring
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
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
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                {getAgentTypeIcon(agent.agent_type)}
                <div className={`absolute w-2.5 h-2.5 rounded-full border border-white dark:border-gray-900 -bottom-0.5 -right-0.5 ${
                  agent.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}></div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{agent.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {agent.agent_type === 'livekit' ? 'LiveKit' : agent.agent_type === 'vapi' ? 'Vapi' : agent.agent_type}
                </p>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-xs">
                  <Eye className="h-3.5 w-3.5 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-xs">
                  <Settings className="h-3.5 w-3.5 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  onCopyId(e)
                }} className="text-xs">
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Copy ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 text-xs">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Environment Badge */}
          <div className="mb-3">
            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md ${getEnvironmentBadgeColor(agent.environment)}`}>
              {agent.environment}
            </span>
          </div>

          {/* Monitoring ID */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Monitoring ID</div>
                <code className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                  {agent.id.slice(0, 8)}...{agent.id.slice(-4)}
                </code>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={onCopyId}
                className="w-6 h-6 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            {isCopied && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1.5">Copied!</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Started {formatDate(agent.created_at)}</span>
            </div>
            <div className={`font-medium ${agent.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {agent.is_active ? 'Monitoring' : 'Paused'}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default AgentListItem