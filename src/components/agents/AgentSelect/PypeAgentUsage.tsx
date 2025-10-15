// src/components/agents/AgentSelect/PypeAgentUsage.tsx
import React, { useState } from 'react'
import { Info } from 'lucide-react'
import { useUserPermissions } from '@/contexts/UserPermissionsContext'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useMobile } from '@/hooks/use-mobile'
import { useParams } from 'next/navigation'

const PypeAgentUsage: React.FC = () => {
  
  const params = useParams()
  const projectId = params.projectid as string

  const { permissions, canCreatePypeAgent } = useUserPermissions({ projectId: projectId })
  const { isMobile } = useMobile(768)
  const [showDetails, setShowDetails] = useState(false)

  console.log('Permissions:', permissions);
  console.log('Can create Pype agent:', canCreatePypeAgent);
  
  // Don't show if user can't create Pype agents
  if (!canCreatePypeAgent || !permissions?.agent) {
    return null
  }

  const activeCount = permissions.agent.usage.active_count || 0
  const maxAgents = permissions.agent.limits.max_agents || 2
  const agentsList = permissions.agent.agents || []
  const hasReachedLimit = activeCount >= maxAgents
  const remainingSlots = Math.max(0, maxAgents - activeCount)

  // Progress percentage
  const usagePercentage = maxAgents > 0 ? (activeCount / maxAgents) * 100 : 0

  return (
    <TooltipProvider>
      <Tooltip open={showDetails} onOpenChange={setShowDetails}>
        <TooltipTrigger asChild>
          <button
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg
              ${hasReachedLimit 
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
              }
              hover:shadow-sm transition-all cursor-pointer
              ${isMobile ? 'text-xs' : 'text-sm'}
            `}
          >
            {/* Usage Text */}
            <span className={`font-medium ${
              hasReachedLimit 
                ? 'text-red-700 dark:text-red-300' 
                : 'text-blue-700 dark:text-blue-300'
            }`}>
              {activeCount}/{maxAgents} Pype Agents
            </span>

            {/* Progress Bar */}
            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  hasReachedLimit 
                    ? 'bg-red-500 dark:bg-red-400' 
                    : 'bg-blue-500 dark:bg-blue-400'
                }`}
                style={{ width: `${Math.min(100, usagePercentage)}%` }}
              />
            </div>

            {/* Info Icon */}
            <Info className={`w-3.5 h-3.5 ${
              hasReachedLimit 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-blue-600 dark:text-blue-400'
            }`} />
          </button>
        </TooltipTrigger>

        <TooltipContent 
          side="bottom" 
          align="end"
          className="w-80 p-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
        >
          {/* Header */}
          <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-800 ${
            hasReachedLimit 
              ? 'bg-red-50 dark:bg-red-900/20' 
              : 'bg-blue-50 dark:bg-blue-900/20'
          }`}>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Pype Agent Usage
            </h3>
            <p className={`text-xs mt-0.5 ${
              hasReachedLimit 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {hasReachedLimit 
                ? 'You\'ve reached your agent limit' 
                : `${remainingSlots} slot${remainingSlots !== 1 ? 's' : ''} remaining`
              }
            </p>
          </div>

          {/* Agent List */}
          <div className="px-4 py-3 space-y-2">
            {agentsList.length > 0 ? (
              <>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Active Agents:
                </p>
                <div className="space-y-1.5">
                  {agentsList.map((agent) => (
                    <div 
                      key={agent.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md bg-gray-50 dark:bg-gray-800"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {agent.name}
                        </p>
                        {agent.phone_number && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {agent.phone_number}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        agent.status === 'active' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {agent.status}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No active agents yet
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {hasReachedLimit 
                ? 'Delete an existing agent to create a new one'
                : 'You can create up to ' + maxAgents + ' Pype agents'
              }
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default PypeAgentUsage