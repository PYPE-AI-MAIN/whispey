'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { KnowledgeBaseUploadZone } from '@/components/knowledge/KnowledgeBaseUploadZone'
import {
  KnowledgeBaseDocumentList,
  type KnowledgeDocument,
} from '@/components/knowledge/KnowledgeBaseDocumentList'

/**
 * Backend expects agent_id = agent name (e.g. Test_a2e7a0fa_c64c_4840_a063_dad5a3df685e),
 * same as used in /agent_config/{agent_name}.
 */
function useBackendAgentName(agentId: string | undefined) {
  const { data: agentDataResponse, isLoading: agentLoading } = useSupabaseQuery(
    'pype_voice_agents',
    {
      select: 'id, name',
      filters: agentId ? [{ column: 'id', operator: 'eq', value: agentId }] : [],
      limit: 1,
      auth: agentId ? { agentId } : undefined,
    }
  )
  const backendAgentName = useMemo(() => {
    if (!agentDataResponse?.[0]?.name || !agentId) return ''
    const sanitized = agentId.replace(/-/g, '_')
    return `${agentDataResponse[0].name}_${sanitized}`
  }, [agentDataResponse, agentId])
  return { backendAgentName, agentLoading }
}

export default function KnowledgeBasePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = Array.isArray(params.projectid) ? params.projectid[0] : params.projectid
  const agentId = Array.isArray(params.agentid) ? params.agentid[0] : params.agentid

  const { role, isLoading: roleLoading } = useMemberVisibility(projectId || undefined)
  useEffect(() => {
    if (roleLoading || !projectId || !agentId) return
    if (role === 'viewer') {
      router.replace(`/${projectId}/agents/${agentId}`)
    }
  }, [role, roleLoading, projectId, agentId, router])

  const { backendAgentName, agentLoading } = useBackendAgentName(agentId)

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDocuments = useCallback(async () => {
    if (!backendAgentName) return
    setLoading(true)
    const url = `/api/knowledge/documents?agent_id=${encodeURIComponent(backendAgentName)}`
    try {
      console.log('[Knowledge Page] Fetching documents with agent_id (backend name):', backendAgentName)
      const res = await fetch(url)
      const data = await res.json().catch(() => ({}))
      console.log('[Knowledge Page] List API response ok=', res.ok, 'status=', res.status, 'data=', data)
      if (res.ok && Array.isArray(data.documents)) {
        setDocuments(data.documents)
        console.log('[Knowledge Page] Set documents count:', data.documents.length)
      } else {
        if (!res.ok) console.warn('[Knowledge Page] List failed or unexpected shape:', data?.error ?? data)
        setDocuments([])
      }
    } catch (err) {
      console.error('[Knowledge Page] Fetch documents error:', err)
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [backendAgentName])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUploadSuccess = useCallback(() => {
    fetchDocuments()
  }, [fetchDocuments])

  if (!agentId || !projectId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Invalid agent or project.</p>
      </div>
    )
  }

  if (agentLoading || (agentId && !backendAgentName)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
              onClick={() => router.push(`/${projectId}/agents/${agentId}`)}
              aria-label="Back to agent"
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
                  Upload documents or URLs so your voice agent can use them in conversation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Add content
            </h2>
            <KnowledgeBaseUploadZone
              agentId={backendAgentName}
              agentIdForRegenerate={agentId}
              onUploadSuccess={handleUploadSuccess}
            />
          </section>

          <section>
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Documents in this knowledge base
            </h2>
            <KnowledgeBaseDocumentList
              documents={documents}
              loading={loading}
              onRefresh={fetchDocuments}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
