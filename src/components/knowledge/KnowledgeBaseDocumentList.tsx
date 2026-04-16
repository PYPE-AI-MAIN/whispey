// src/components/knowledge/KnowledgeBaseDocumentList.tsx
'use client'

import React, { useCallback, useState } from 'react'
import { FileText, Trash2, Loader2, Link as LinkIcon, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getKnowledgeFileTypeLabel } from './constants'
import { cn } from '@/lib/utils'

export interface KnowledgeDocument {
  id: string
  name?: string
  filename?: string
  type?: 'file' | 'url'
  url?: string
  created_at?: string
  [key: string]: unknown
}

interface KnowledgeBaseDocumentListProps {
  documents: KnowledgeDocument[]
  loading?: boolean
  onDelete?: (id: string) => void
  onRefresh?: () => void
  className?: string
}

export function KnowledgeBaseDocumentList({
  documents,
  loading = false,
  onDelete,
  onRefresh,
  className,
}: KnowledgeBaseDocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = useCallback(
    async (id: string) => {
      if (deletingId) return
      setDeletingId(id)
      setError(null)
      try {
        const res = await fetch(`/api/knowledge/documents/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data?.error || 'Failed to delete')
          return
        }
        onDelete?.(id)
        onRefresh?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete')
      } finally {
        setDeletingId(null)
      }
    },
    [deletingId, onDelete, onRefresh]
  )

  const displayName = (doc: KnowledgeDocument) =>
    doc.name || doc.filename || doc.url || doc.id

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!documents?.length) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 py-12 text-center',
          className
        )}
      >
        <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No documents yet</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          Upload files or add a URL above to build your knowledge base.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {error && (
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ul className="space-y-1">
        {documents.map((doc) => {
          const isUrl = doc.type === 'url' || !!doc.url
          const name = displayName(doc)
          const isDeleting = deletingId === doc.id
          return (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 px-4 py-3 group"
            >
              {isUrl ? (
                <LinkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              ) : (
                <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isUrl ? 'URL' : getKnowledgeFileTypeLabel(name)}
                  {doc.created_at && (
                    <span className="ml-2">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={() => handleDelete(doc.id)}
                disabled={isDeleting}
                aria-label={`Delete ${name}`}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
