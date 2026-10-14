// src/components/knowledge/KnowledgeBaseDocumentList.tsx
'use client'

import React, { useCallback, useState } from 'react'
import { FileText, Trash2, Loader2, Link as LinkIcon, AlertCircle, Eye, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  agentId?: string
}

export function KnowledgeBaseDocumentList({
  documents,
  loading = false,
  onDelete,
  onRefresh,
  className,
  agentId,
}: KnowledgeBaseDocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = useCallback(
    async (id: string) => {
      if (deletingId) return
      setDeletingId(id)
      setError(null)
      try {
        const query = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ''
        const res = await fetch(`/api/knowledge/documents/${encodeURIComponent(id)}${query}`, {
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
    [deletingId, onDelete, onRefresh, agentId]
  )

  const [viewing, setViewing] = useState<{ doc: KnowledgeDocument; text: string | null; failed?: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadText = useCallback(
    async (id: string): Promise<string> => {
      const res = await fetch(`/api/knowledge/documents/${encodeURIComponent(id)}/content?agent_id=${encodeURIComponent(agentId ?? '')}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || typeof data.text !== 'string') throw new Error(data?.error || 'Could not load the document')
      return data.text
    },
    [agentId]
  )

  const handleView = useCallback(
    async (doc: KnowledgeDocument) => {
      setViewing({ doc, text: null })
      try {
        setViewing({ doc, text: await loadText(doc.id) })
      } catch (e) {
        setViewing({ doc, text: null, failed: e instanceof Error ? e.message : 'Could not load the document' })
      }
    },
    [loadText]
  )

  const handleDownload = useCallback(
    async (doc: KnowledgeDocument, name: string) => {
      setBusyId(doc.id)
      setError(null)
      try {
        const text = await loadText(doc.id)
        const link = document.createElement('a')
        link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
        // What is stored is the extracted text, so the download is a .txt of it.
        link.download = `${name.replace(/^https?:\/\//, '').replaceAll(/[^\w.-]+/g, '_').replace(/\.[a-z0-9]{2,4}$/i, '')}.txt`
        link.click()
        URL.revokeObjectURL(link.href)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not download the document')
      } finally {
        setBusyId(null)
      }
    },
    [loadText]
  )

  const displayName = (doc: KnowledgeDocument) =>
    doc.name || doc.filename || doc.url || doc.id

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!documents?.length) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-border bg-muted/50 py-12 text-center',
          className
        )}
      >
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No documents yet</p>
        <p className="text-xs text-muted-foreground mt-1">
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
              className="flex items-center gap-3 rounded-xl border border-border bg-card shadow-sm px-4 py-3 group"
            >
              {isUrl ? (
                <LinkIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {name}
                </p>
                <p className="text-xs text-muted-foreground">
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
                className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={() => handleView(doc)}
                aria-label={`View ${name}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={() => handleDownload(doc, name)}
                disabled={busyId === doc.id}
                aria-label={`Download ${name}`}
              >
                {busyId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
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
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{viewing ? displayName(viewing.doc) : ''}</DialogTitle>
          </DialogHeader>
          {viewing?.failed && <p className="text-sm text-destructive">{viewing.failed}</p>}
          {!viewing?.failed && viewing?.text === null && (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}
          {typeof viewing?.text === 'string' && (
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/50 p-4 text-xs leading-relaxed text-foreground">{viewing.text}</pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
