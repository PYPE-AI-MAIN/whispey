'use client'

import React, { useCallback, useState } from 'react'
import { Upload, Link as LinkIcon, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  isAllowedKnowledgeFile,
  KNOWLEDGE_MAX_FILE_SIZE_BYTES,
  KNOWLEDGE_MAX_FILE_SIZE_MB,
  KNOWLEDGE_ALLOWED_EXTENSIONS,
} from './constants'
import { cn } from '@/lib/utils'

interface KnowledgeBaseUploadZoneProps {
  /** Backend agent name (e.g. Test_uuid), same as used in /agent_config and knowledge API */
  agentId: string
  /** Supabase agent UUID; when set, we trigger config regeneration after upload/URL so knowledge_search is auto-added */
  agentIdForRegenerate?: string
  onUploadSuccess?: () => void
  onUploadError?: (message: string) => void
  disabled?: boolean
  className?: string
}

/** Call backend to regenerate assistant so knowledge_search tool is auto-injected. Fire-and-forget. */
async function regenerateAgentConfigAfterKnowledgeUpdate(
  backendAgentName: string,
  agentIdUuid: string
) {
  try {
    const configRes = await fetch(
      `/api/agent-config/${encodeURIComponent(backendAgentName)}`
    )
    if (!configRes.ok) return
    const config = await configRes.json().catch(() => null)
    if (!config?.agent) return
    await fetch('/api/agents/save-and-deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: config.agent,
        metadata: { agentName: backendAgentName, agentId: agentIdUuid },
      }),
    })
  } catch {
    // Non-blocking; user can still Save from Agent Config if needed
  }
}

export function KnowledgeBaseUploadZone({
  agentId,
  agentIdForRegenerate,
  onUploadSuccess,
  onUploadError,
  disabled = false,
  className,
}: KnowledgeBaseUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [urlSubmitting, setUrlSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!isAllowedKnowledgeFile(file)) {
        const msg = `Unsupported file type. Allowed: ${KNOWLEDGE_ALLOWED_EXTENSIONS.join(', ')}`
        setError(msg)
        onUploadError?.(msg)
        return
      }
      if (file.size > KNOWLEDGE_MAX_FILE_SIZE_BYTES) {
        const msg = `File too large. Max size: ${KNOWLEDGE_MAX_FILE_SIZE_MB}MB`
        setError(msg)
        onUploadError?.(msg)
        return
      }

      setUploading(true)
      setError(null)
      try {
        const formData = new FormData()
        formData.append('agent_id', agentId)
        formData.append('file', file)

        const res = await fetch('/api/knowledge/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = data?.error || `Upload failed (${res.status})`
          setError(msg)
          onUploadError?.(msg)
          return
        }
        onUploadSuccess?.()
        if (agentIdForRegenerate && agentId) {
          regenerateAgentConfigAfterKnowledgeUpdate(agentId, agentIdForRegenerate)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed'
        setError(msg)
        onUploadError?.(msg)
      } finally {
        setUploading(false)
      }
    },
    [agentId, agentIdForRegenerate, onUploadSuccess, onUploadError]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled || uploading) return
      const file = e.dataTransfer.files[0]
      if (file) handleFileUpload(file)
    },
    [disabled, uploading, handleFileUpload]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileUpload(file)
      e.target.value = ''
    },
    [handleFileUpload]
  )

  const handleUrlSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const url = urlValue.trim()
      if (!url) return
      if (disabled || urlSubmitting) return

      setUrlSubmitting(true)
      setError(null)
      try {
        const res = await fetch('/api/knowledge/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, agent_id: agentId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = data?.error || `URL ingestion failed (${res.status})`
          setError(msg)
          onUploadError?.(msg)
          return
        }
        setUrlValue('')
        onUploadSuccess?.()
        if (agentIdForRegenerate && agentId) {
          regenerateAgentConfigAfterKnowledgeUpdate(agentId, agentIdForRegenerate)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'URL ingestion failed'
        setError(msg)
        onUploadError?.(msg)
      } finally {
        setUrlSubmitting(false)
      }
    },
    [
      urlValue,
      agentId,
      agentIdForRegenerate,
      disabled,
      urlSubmitting,
      onUploadSuccess,
      onUploadError,
    ]
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* File upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center min-h-[180px] p-6',
          isDragging
            ? 'border-primary bg-primary/5 dark:bg-primary/10'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 hover:border-gray-400 dark:hover:border-gray-500',
          (disabled || uploading) && 'pointer-events-none opacity-70'
        )}
      >
        <input
          type="file"
          accept={KNOWLEDGE_ALLOWED_EXTENSIONS.join(',')}
          onChange={handleFileInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          disabled={disabled || uploading}
          aria-label="Upload document"
        />
        {uploading ? (
          <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
        ) : (
          <Upload className="h-10 w-10 text-gray-500 dark:text-gray-400 mb-2" />
        )}
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {uploading ? 'Uploading…' : 'Drag and drop or click to upload'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          PDF, TXT, DOC, DOCX, CSV up to {KNOWLEDGE_MAX_FILE_SIZE_MB}MB
        </p>
      </div>

      {/* URL ingestion */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-2">
          <LinkIcon className="h-4 w-4" />
          Add from URL
        </Label>
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <Input
            type="url"
            placeholder="https://example.com/page"
            value={urlValue}
            onChange={(e) => {
              setUrlValue(e.target.value)
              clearError()
            }}
            disabled={disabled || urlSubmitting}
            className="flex-1"
          />
          <Button type="submit" disabled={!urlValue.trim() || disabled || urlSubmitting} size="sm">
            {urlSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Add'
            )}
          </Button>
        </form>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
