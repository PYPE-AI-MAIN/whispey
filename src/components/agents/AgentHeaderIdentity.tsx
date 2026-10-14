'use client'

import { AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import AgentNameEditor from './AgentNameEditor'

interface AgentHeaderAgent {
  id: string
  name?: string | null
  display_name?: string | null
  environment: string
}

interface AgentHeaderIdentityProps {
  agentLoading: boolean
  agent: AgentHeaderAgent | null
  isMobile: boolean
  isViewer: boolean
  onSaved: () => void
}

function environmentColor(environment: string): string {
  switch (environment.toLowerCase()) {
    case 'production':
    case 'prod':
      return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800'
    case 'staging':
    case 'stage':
      return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800'
    case 'development':
    case 'dev':
      return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800'
    default:
      return 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700'
  }
}

/**
 * Agent name + environment badge shown in the Dashboard header. Extracted so the
 * three-way loading/found/not-found branch lives here instead of inflating the
 * (very large) Dashboard component's cognitive complexity.
 */
export default function AgentHeaderIdentity({
  agentLoading,
  agent,
  isMobile,
  isViewer,
  onSaved,
}: Readonly<AgentHeaderIdentityProps>) {
  if (agentLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className={isMobile ? 'h-6 w-32' : 'h-8 w-40'} />
        <Skeleton className={`${isMobile ? 'h-5 w-16' : 'h-6 w-20'} rounded-full`} />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className={`${isMobile ? 'h-7' : 'h-8'} bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 rounded-lg flex items-center`}>
        <AlertCircle className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'}`} />
        <span className={isMobile ? 'text-xs' : 'text-sm'}>Agent not found</span>
      </div>
    )
  }

  return (
    <>
      <AgentNameEditor agent={agent} canEdit={!isViewer} isMobile={isMobile} onSaved={onSaved} />
      <div className="flex items-center gap-2">
        <Badge className={`${isMobile ? 'text-xs px-2 py-0.5' : 'text-xs px-3 py-1'} font-medium rounded-full ${environmentColor(agent.environment)}`}>
          {agent.environment}
        </Badge>
      </div>
    </>
  )
}
