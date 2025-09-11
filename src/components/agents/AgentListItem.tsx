import React from 'react'
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
  onClick: () => void
  onCopyId: (e: React.MouseEvent) => void
  onDelete: () => void
}

const getAgentTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'livekit':
      return <Activity className="w-4 h-4" />
    case 'vapi':
      return <Eye className="w-4 h-4" />
    default:
      return <Bot className="w-4 h-4" />
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
      return 'bg-red-100 text-red-700'
    case 'staging':
    case 'stage':
      return 'bg-yellow-100 text-yellow-700'
    default:
      return 'bg-blue-100 text-blue-700'
  }
}

const AgentListItem: React.FC<AgentListItemProps> = ({
  agent,
  viewMode,
  isSelected,
  isCopied,
  isLastItem,
  onClick,
  onCopyId,
  onDelete
}) => {
  if (viewMode === 'list') {
    return (
      <div
        className={`group px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 ${
          isLastItem ? '' : 'border-b'
        } ${isSelected ? 'bg-blue-50' : ''}`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          {/* Left: Agent Info */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 relative">
              {getAgentTypeIcon(agent.agent_type)}
              <div className={`absolute w-3 h-3 rounded-full border-2 border-white -bottom-0.5 -right-0.5 ${
                agent.is_active ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-medium text-gray-900 truncate">{agent.name}</h3>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {agent.agent_type === 'livekit' ? 'LiveKit' : agent.agent_type === 'vapi' ? 'Vapi' : agent.agent_type}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${getEnvironmentBadgeColor(agent.environment)}`}>
                  {agent.environment}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>ID: {agent.id.slice(0, 8)}...{agent.id.slice(-4)}</span>
                <span>Started {formatDate(agent.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Right: Status & Actions */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-sm font-medium ${agent.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                {agent.is_active ? 'Monitoring' : 'Paused'}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 w-8 h-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-white/95 backdrop-blur-lg border border-gray-200 rounded-lg shadow-lg">
                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                  <Eye className="h-4 w-4 mr-3 text-gray-500" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                  <BarChart3 className="h-4 w-4 mr-3 text-gray-500" />
                  Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-sm">
                  <Settings className="h-4 w-4 mr-3 text-gray-500" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  onCopyId(e)
                }} className="text-sm">
                  <Copy className="h-4 w-4 mr-3 text-gray-500" />
                  Copy Monitoring ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }} className="text-red-600 focus:text-red-600 text-sm">
                  <Trash2 className="h-4 w-4 mr-3" />
                  Remove Monitoring
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    )
  }

  // Grid view
  return (
    <div
      className={`group bg-white border border-gray-200 rounded-lg hover:shadow-sm cursor-pointer transition-all duration-200 ${
        isSelected ? 'ring-1 ring-blue-500 border-blue-300' : 'hover:border-gray-300'
      }`}
      onClick={onClick}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 relative">
              {getAgentTypeIcon(agent.agent_type)}
              <div className={`absolute w-3 h-3 rounded-full border-2 border-white -bottom-0.5 -right-0.5 ${
                agent.is_active ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-gray-900 truncate">{agent.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {agent.agent_type === 'livekit' ? 'LiveKit' : agent.agent_type === 'vapi' ? 'Vapi' : agent.agent_type}
              </p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 w-8 h-8 p-0 text-gray-400 hover:text-gray-600"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
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
              }} className="text-red-600 focus:text-red-600 text-sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Environment Badge */}
        <div className="mb-4">
          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md ${getEnvironmentBadgeColor(agent.environment)}`}>
            {agent.environment}
          </span>
        </div>

        {/* Monitoring ID */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Monitoring ID</div>
              <code className="text-xs text-gray-700 font-mono">
                {agent.id.slice(0, 8)}...{agent.id.slice(-4)}
              </code>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCopyId}
              className="w-8 h-8 p-0 text-gray-400 hover:text-gray-600"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
          {isCopied && (
            <p className="text-xs text-green-600 mt-2">Copied!</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Started {formatDate(agent.created_at)}</span>
          </div>
          <div className={`font-medium ${agent.is_active ? 'text-green-600' : 'text-gray-500'}`}>
            {agent.is_active ? 'Monitoring' : 'Paused'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentListItem