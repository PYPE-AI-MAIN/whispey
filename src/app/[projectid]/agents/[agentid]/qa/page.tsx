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
import Link from 'next/link'
import { ChevronRight, ShieldCheck } from 'lucide-react'
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
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex-none border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-900 md:px-8">
        <nav className="flex items-center gap-2 text-sm">
          <Link href={`/${projectId}/agents`} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
            Agents
          </Link>
          <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
          <Link
            href={`/${projectId}/agents/${agentId}`}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Agent
          </Link>
          <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
          <span className="inline-flex items-center gap-1.5 text-gray-900 dark:text-gray-100">
            <ShieldCheck className="h-4 w-4 text-gray-400" />
            QA Audit
          </span>
        </nav>
      </div>

      <div className="min-h-0 flex-1">
        <QaAuditPanel agentId={agentId} projectId={projectId} />
      </div>
    </div>
  )
}
