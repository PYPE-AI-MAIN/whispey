'use client'

/**
 * Agent → QA Audit: flagged calls and weekly reviews.
 *
 * Its own route rather than a `?tab=` on the agent dashboard, for the same
 * reason `observability` is: it is a destination, and keeping it mounted behind
 * a hidden tab would have it refetching on every agent page view.
 */
import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import QaAuditPanel from '@/components/qa/QaAuditPanel'

export default function AgentQaPage() {
  return (
    <Suspense fallback={null}>
      <AgentQaPageContent />
    </Suspense>
  )
}

function AgentQaPageContent() {
  const params = useParams()
  const projectId = params.projectid as string
  const agentId = params.agentid as string

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="min-h-0 flex-1">
        <QaAuditPanel agentId={agentId} projectId={projectId} />
      </div>
    </div>
  )
}
