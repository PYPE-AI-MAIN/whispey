'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { KnowledgeBaseUploadZone } from '@/components/knowledge/KnowledgeBaseUploadZone'
import {
  KnowledgeBaseDocumentList,
  type KnowledgeDocument,
} from '@/components/knowledge/KnowledgeBaseDocumentList'
import { useStudio } from '../_context'

export default function StudioKnowledgeBasePage() {
  const { agentId, backendAgentName, isLoading } = useStudio()

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(true)

  const fetchDocuments = useCallback(async () => {
    if (!backendAgentName) return
    setDocsLoading(true)
    try {
      const res = await fetch(`/api/knowledge/documents?agent_id=${encodeURIComponent(backendAgentName)}`)
      const data = await res.json().catch(() => ({}))
      setDocuments(res.ok && Array.isArray(data.documents) ? data.documents : [])
    } catch {
      setDocuments([])
    } finally {
      setDocsLoading(false)
    }
  }, [backendAgentName])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  if (isLoading || !backendAgentName) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-500">
          Add content
        </h2>
        <KnowledgeBaseUploadZone
          agentId={backendAgentName}
          agentIdForRegenerate={agentId}
          onUploadSuccess={fetchDocuments}
        />
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-gray-500">
          Documents
        </h2>
        <KnowledgeBaseDocumentList
          documents={documents}
          loading={docsLoading}
          onRefresh={fetchDocuments}
          agentId={backendAgentName}
        />
      </section>
    </div>
  )
}
