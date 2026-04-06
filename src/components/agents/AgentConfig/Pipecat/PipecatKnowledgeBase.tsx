// src/components/agents/AgentConfig/Pipecat/PipecatKnowledgeBase.tsx
'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, BookOpen, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PipecatUploadZone from './PipecatUploadZone'

interface KnowledgeDocument {
  id: string
  name?: string
  filename?: string
  created_at?: string
  [key: string]: unknown
}

interface PipecatKnowledgeBaseProps {
  pipecatAgentId: string
}

export default function PipecatKnowledgeBase({ pipecatAgentId }: PipecatKnowledgeBaseProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    if (!pipecatAgentId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pipecat/agents/${pipecatAgentId}/knowledge`)
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data?.error || 'Failed to load documents')
        setDocuments([])
        return
      }

      // Handle multiple response shapes from pipecat backend
      const docs =
        Array.isArray(data) ? data :
        Array.isArray(data.documents) ? data.documents :
        Array.isArray(data.data) ? data.data :
        Array.isArray(data.items) ? data.items :
        []

      setDocuments(docs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [pipecatAgentId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleDeleteDocument = useCallback(async (docId: string) => {
    const res = await fetch(
      `/api/pipecat/agents/${pipecatAgentId}/knowledge/${encodeURIComponent(docId)}`,
      { method: 'DELETE' }
    )
    if (res.ok) fetchDocuments()
  }, [pipecatAgentId, fetchDocuments])

  return (
    <div className="flex flex-col h-full overflow-y-auto space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="h-8 w-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
          <BookOpen className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Knowledge Base</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Upload documents the agent can reference during calls
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <PipecatUploadZone
        pipecatAgentId={pipecatAgentId}
        onUploadSuccess={fetchDocuments}
      />

      {/* Document list */}
      <div className="flex-1 min-h-0">
        <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Documents {documents.length > 0 && `(${documents.length})`}
        </h3>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 py-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No documents yet</p>
            <p className="text-xs text-gray-500 mt-1">Upload files or add a URL above.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {documents.map(doc => (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 px-4 py-3 group"
              >
                <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {doc.name || doc.filename || doc.id}
                  </p>
                  {doc.created_at && (
                    <p className="text-xs text-gray-500">
                      {new Date(doc.created_at as string).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={() => handleDeleteDocument(doc.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}