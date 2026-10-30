'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, Copy, Sparkles } from 'lucide-react'
import AgentHeaderIdentity from '@/components/agents/AgentHeaderIdentity'
import { AskPypeForHelp } from '@/components/agents/AgentStudio/AskPypeForHelp'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { StudioProvider, useStudio } from './_context'

function StudioShell({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter()
  const { projectId, agentId, agent, isLoading, refetchAgent } = useStudio()
  const [copied, setCopied] = useState(false)

  // The MCP takes the agent's id (not its name), so it needs to be one click away.
  const copyAgentId = async () => {
    try {
      await navigator.clipboard.writeText(agentId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked (insecure origin / permissions) — nothing useful to show
    }
  }
  const { isViewer } = useMemberVisibility(projectId || undefined)

  return (
    <div className="flex h-screen flex-col bg-muted/50">
      {/* Same header chrome as the agent Dashboard, so Studio reads as part of it */}
      <div className="border-b border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-4 px-8 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/${projectId}/agents`)}
              aria-label="Back to agents"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-muted-foreground"
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
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Studio · Beta
              </span>
              <button
                onClick={copyAgentId}
                title="Copy agent ID"
                aria-label="Copy agent ID"
                className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy ID'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Changes to this agent are made through the MCP
            </p>
            {agentId && <AskPypeForHelp agentId={agentId} />}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

export default function StudioLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <StudioProvider>
      <StudioShell>{children}</StudioShell>
    </StudioProvider>
  )
}
