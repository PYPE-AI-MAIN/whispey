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
      return 'bg-destructive/10 text-destructive border border-destructive/20'
    case 'staging':
    case 'stage':
      return 'bg-warning/10 text-warning border border-warning/20'
    case 'development':
    case 'dev':
      return 'bg-primary/10 text-primary border border-primary/20'
    default:
      return 'bg-muted/50 text-foreground border border-border/60'
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
      <div className={`${isMobile ? 'h-7' : 'h-8'} bg-destructive/15 text-destructive px-3 rounded-lg flex items-center`}>
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
