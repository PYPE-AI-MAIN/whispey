// src/app/[projectid]/agents/[agentid]/config/pipecat/knowledgebase/page.tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { Loader2, ArrowLeft, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PipecatKnowledgeBase from '@/components/agents/AgentConfig/Pipecat/PipecatKnowledgeBase'

export default function PipecatKnowledgeBasePage() {
  const params = useParams()
  const router = useRouter()
  const agentId = Array.isArray(params.agentid) ? params.agentid[0] : params.agentid || ''
  const projectId = Array.isArray(params.projectid) ? params.projectid[0] : params.projectid || ''

  const { data: agentDataResponse, isLoading } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, configuration',
    filters: [{ column: 'id', operator: 'eq', value: agentId }],
    limit: 1,
    auth: agentId ? { agentId } : undefined,
  })

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const agent = agentDataResponse?.[0]
  const pipecatAgentId = agent?.configuration?.pipecat_agent_id

  if (!pipecatAgentId) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <p className="text-sm text-red-500">Pipecat agent ID not found in configuration.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => router.push(`/${projectId}/agents/${agentId}/config/pipecat`)}
              aria-label="Back to agent config"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Knowledge Base
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {agent?.name} · Pipecat
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6">
        <PipecatKnowledgeBase pipecatAgentId={pipecatAgentId} />
      </div>
    </div>
  )
}