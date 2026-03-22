'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Flag, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FlagData {
  text: string
  flagged_at: string
}

export interface FlagEditorProps {
  callId: string
  initialFlag?: FlagData | null
  onUpdated?: () => void
}

export const FlagEditor: React.FC<FlagEditorProps> = ({
  callId,
  initialFlag,
  onUpdated,
}) => {
  const [flag, setFlag] = useState<FlagData | null>(initialFlag ?? null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initialFlag?.text ?? '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setFlag(initialFlag ?? null)
    setDraft(initialFlag?.text ?? '')
  }, [initialFlag])

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50)
  }, [open])

  const persist = useCallback(async (nextFlag: { text: string } | null) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/logs/call-logs/${callId}/flag`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag: nextFlag }),
      })
      if (!res.ok) throw new Error(await res.text())
      if (nextFlag === null) {
        setFlag(null)
        setDraft('')
      } else {
        setFlag({ text: nextFlag.text, flagged_at: new Date().toISOString() })
      }
      onUpdated?.()
    } catch (err) {
      console.error('Failed to save flag:', err)
      setFlag(initialFlag ?? null)
      setDraft(initialFlag?.text ?? '')
    } finally {
      setSaving(false)
    }
  }, [callId, initialFlag, onUpdated])

  const handleSave = () => {
    if (!draft.trim()) return
    persist({ text: draft.trim() })
    setOpen(false)
  }

  const handleClear = () => {
    persist(null)
    setOpen(false)
  }

  const isFlagged = Boolean(flag?.text)

  // ── Tooltip message ────────────────────────────────────────────────────────
  const tooltipContent = isFlagged && flag
    ? (
      <div className="flex items-start gap-1.5 max-w-[220px]">
        <Flag className="w-3 h-3 mt-0.5 shrink-0 text-rose-400" style={{ fill: 'currentColor' }} />
        <span className="whitespace-pre-wrap text-xs">{flag.text}</span>
      </div>
    )
    : <span className="text-xs">Report an issue in this call</span>

  return (
    <div onClick={e => e.stopPropagation()}>
      {/*
        Radix UI composition pattern for Tooltip + Popover sharing one trigger:
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button />          ← the real DOM node
              </PopoverTrigger>
            </TooltipTrigger>
          </Tooltip>
        This order ensures click reaches the PopoverTrigger correctly.
      */}
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              {isFlagged ? (
                // Flagged — solid red badge, unmistakably red
                <button
                  aria-label="Edit flag"
                  disabled={saving}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold select-none transition-all cursor-pointer',
                    'bg-rose-600 text-white border border-rose-700',
                    'hover:bg-rose-700 active:scale-95',
                    saving && 'opacity-40 pointer-events-none'
                  )}
                >
                  <Flag className="w-2.5 h-2.5 shrink-0" style={{ fill: 'currentColor' }} />
                  <span>Flagged</span>
                </button>
              ) : (
                // Unflagged — dashed pill, turns rose-red on hover
                <button
                  aria-label="Add flag"
                  disabled={saving}
                  className={cn(
                    'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium select-none transition-all cursor-pointer',
                    'border border-dashed border-gray-300 dark:border-gray-600',
                    'text-gray-400 dark:text-gray-500',
                    'hover:border-rose-400 hover:text-rose-500 dark:hover:border-rose-500 dark:hover:text-rose-400 active:scale-95',
                    saving && 'opacity-40 pointer-events-none'
                  )}
                >
                  <Flag className="w-2.5 h-2.5 shrink-0" />
                  <span>Flag</span>
                </button>
              )}
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipContent}</TooltipContent>
        </Tooltip>

        <PopoverContent
          className="w-72 p-3 shadow-lg"
          align="start"
          side="bottom"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Flag className="w-3 h-3 text-rose-500 shrink-0" style={{ fill: 'currentColor' }} />
              <span>{isFlagged ? 'Edit flag' : 'Report an issue'}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Timestamp of existing flag */}
          {isFlagged && flag && (
            <div className="mb-2 text-[10px] text-muted-foreground">
              Flagged {new Date(flag.flagged_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={`e.g. "Response at 2:30 was incorrect"`}
            rows={3}
            className={cn(
              'w-full resize-none rounded-md border border-input bg-background px-2 py-1.5',
              'text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
              'mb-2'
            )}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
              if (e.key === 'Escape') setOpen(false)
            }}
          />

          <div className="flex items-center justify-between gap-2">
            {isFlagged && (
              <button
                onClick={handleClear}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                Remove flag
              </button>
            )}
            <div className="flex gap-1.5 ml-auto">
              <button
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                disabled={!draft.trim()}
                className={cn(
                  'text-[11px] bg-rose-600 text-white px-2 py-1 rounded hover:bg-rose-700 transition-colors',
                  !draft.trim() && 'opacity-40 cursor-not-allowed'
                )}
                onClick={handleSave}
              >
                {isFlagged ? 'Update' : 'Submit'}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">⌘ Enter to submit</p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
