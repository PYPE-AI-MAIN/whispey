'use client'

import { type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Sparkles } from 'lucide-react'
import AgentHeaderIdentity from '@/components/agents/AgentHeaderIdentity'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { StudioProvider, useStudio } from './_context'

function StudioShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { projectId, agent, isLoading, refetchAgent } = useStudio()
  const { isViewer } = useMemberVisibility(projectId || undefined)

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Same header chrome as the agent Dashboard, so Studio reads as part of it */}
      <div className="border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between gap-4 px-8 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/${projectId}/agents`)}
              aria-label="Back to agents"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-all duration-200 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <AgentHeaderIdentity
                agentLoading={isLoading}
                agent={agent}
                isMobile={false}
                isViewer={isViewer}
                onSaved={refetchAgent}
              />
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-700/70 dark:text-gray-400">
                Studio · Beta
              </span>
            </div>
          </div>
          <p className="hidden items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 md:flex">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            Changes to this agent are made through the MCP
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <StudioProvider>
      <StudioShell>{children}</StudioShell>
    </StudioProvider>
  )
}
