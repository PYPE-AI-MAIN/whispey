// src/components/agents/AgentConfig/Pipecat/PipecatUploadZone.tsx
'use client'

import React, { useCallback, useRef, useState } from 'react'
import { Loader2, Upload, Link as LinkIcon, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  KNOWLEDGE_MAX_FILE_SIZE_BYTES,
  KNOWLEDGE_MAX_FILE_SIZE_MB,
  KNOWLEDGE_ALLOWED_EXTENSIONS,
  isAllowedKnowledgeFile,
} from '@/components/knowledge/constants'

interface PipecatUploadZoneProps {
  pipecatAgentId: string
  onUploadSuccess: () => void
}

export default function PipecatUploadZone({ pipecatAgentId, onUploadSuccess }: PipecatUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [urlSubmitting, setUrlSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(async (file: File) => {
    if (!isAllowedKnowledgeFile(file)) {
      setError(`Unsupported type. Allowed: ${KNOWLEDGE_ALLOWED_EXTENSIONS.join(', ')}`)
      return
    }
    if (file.size > KNOWLEDGE_MAX_FILE_SIZE_BYTES) {
      setError(`File too large. Max: ${KNOWLEDGE_MAX_FILE_SIZE_MB}MB`)
      return
    }
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/pipecat/agents/${pipecatAgentId}/knowledge/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.error || 'Upload failed'); return }
      onUploadSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [pipecatAgentId, onUploadSuccess])

  const handleUrlSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const url = urlValue.trim()
    if (!url) return
    setUrlSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/pipecat/agents/${pipecatAgentId}/knowledge/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.error || 'URL ingestion failed'); return }
      setUrlValue('')
      onUploadSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'URL ingestion failed')
    } finally {
      setUrlSubmitting(false)
    }
  }, [urlValue, pipecatAgentId, onUploadSuccess])

  return (
    <div className="space-y-3 flex-shrink-0">
      {/* Drop zone */}
      <div
        onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center min-h-[140px] p-4 cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 hover:border-gray-400 dark:hover:border-gray-500',
          uploading && 'pointer-events-none opacity-70'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={KNOWLEDGE_ALLOWED_EXTENSIONS.join(',')}
          className="hidden"
          disabled={uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }}
        />
        {uploading
          ? <Loader2 className="h-8 w-8 text-primary animate-spin mb-1" />
          : <Upload className="h-8 w-8 text-gray-400 mb-1" />
        }
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {uploading ? 'Uploading…' : 'Drop file or click to upload'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          PDF, TXT, DOCX, CSV · max {KNOWLEDGE_MAX_FILE_SIZE_MB}MB
        </p>
      </div>

      {/* URL input */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-2">
          <LinkIcon className="h-3.5 w-3.5" />
          Add from URL
        </p>
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <Input
            type="url"
            placeholder="https://example.com/page"
            value={urlValue}
            onChange={e => { setUrlValue(e.target.value); setError(null) }}
            disabled={urlSubmitting}
            className="flex-1 h-7 text-xs"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!urlValue.trim() || urlSubmitting}
            className="h-7 text-xs px-3"
          >
            {urlSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
          </Button>
        </form>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-lg py-2">
          <AlertCircle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}