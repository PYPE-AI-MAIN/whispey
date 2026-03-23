'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Plus, X, Tag, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Color palette ─────────────────────────────────────────────────────────────
// Inline styles are used instead of Tailwind classes because the class strings
// are assembled dynamically from an array at runtime — Tailwind's static scanner
// can't detect them, so they get purged and the tags render unstyled.
//
// Light: high-contrast text on a gentle tinted background
// Dark:  luminous text on a low-opacity tinted background (avoids harsh blacks)
// ──────────────────────────────────────────────────────────────────────────────
interface TagColorSpec {
  light: { bg: string; text: string; border: string }
  dark:  { bg: string; text: string; border: string }
}

const TAG_PALETTE: TagColorSpec[] = [
  // Indigo
  {
    light: { bg: '#EEF2FF', text: '#3730A3', border: '#A5B4FC' },
    dark:  { bg: 'rgba(79,70,229,0.18)', text: '#A5B4FC', border: 'rgba(129,120,254,0.45)' },
  },
  // Emerald
  {
    light: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
    dark:  { bg: 'rgba(16,185,129,0.18)', text: '#6EE7B7', border: 'rgba(52,211,153,0.45)' },
  },
  // Violet
  {
    light: { bg: '#EDE9FE', text: '#5B21B6', border: '#C4B5FD' },
    dark:  { bg: 'rgba(139,92,246,0.18)', text: '#C4B5FD', border: 'rgba(167,139,250,0.45)' },
  },
  // Amber
  {
    light: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
    dark:  { bg: 'rgba(245,158,11,0.18)', text: '#FCD34D', border: 'rgba(251,191,36,0.45)' },
  },
  // Rose
  {
    light: { bg: '#FFE4E6', text: '#9F1239', border: '#FECDD3' },
    dark:  { bg: 'rgba(225,29,72,0.18)',  text: '#FDA4AF', border: 'rgba(253,164,175,0.45)' },
  },
  // Sky
  {
    light: { bg: '#E0F2FE', text: '#0C4A6E', border: '#7DD3FC' },
    dark:  { bg: 'rgba(14,165,233,0.18)', text: '#7DD3FC', border: 'rgba(56,189,248,0.45)' },
  },
  // Orange
  {
    light: { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' },
    dark:  { bg: 'rgba(249,115,22,0.18)', text: '#FDBA74', border: 'rgba(251,146,60,0.45)' },
  },
  // Teal
  {
    light: { bg: '#CCFBF1', text: '#134E4A', border: '#5EEAD4' },
    dark:  { bg: 'rgba(20,184,166,0.18)', text: '#5EEAD4', border: 'rgba(45,212,191,0.45)' },
  },
]

function hashTag(tag: string): number {
  let h = 0
  for (let i = 0; i < tag.length; i++) {
    h = ((h << 5) - h + tag.charCodeAt(i)) | 0
  }
  return Math.abs(h) % TAG_PALETTE.length
}

function useTagColor(tag: string) {
  const { resolvedTheme } = useTheme()
  const spec = TAG_PALETTE[hashTag(tag)]
  return resolvedTheme === 'dark' ? spec.dark : spec.light
}

// ─── TagBadge ─────────────────────────────────────────────────────────────────
// When canComment is true, clicking the badge opens a comment popover for that tag.
// A small chat icon indicates an existing comment.
interface TagBadgeProps {
  tag: string
  comment?: string
  canComment: boolean
  /** When true the comment popover opens automatically on mount (used after tag creation) */
  autoOpen?: boolean
  onCommentPopoverOpened?: () => void
  onRemove: (tag: string) => void
  onCommentSave: (tag: string, comment: string) => void
}

const TagBadge: React.FC<TagBadgeProps> = ({
  tag, comment, canComment, autoOpen = false,
  onCommentPopoverOpened, onRemove, onCommentSave,
}) => {
  const color = useTagColor(tag)
  const [commentOpen, setCommentOpen] = useState(false)
  const [draft, setDraft] = useState(comment || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Grace-period flag: prevents Radix from immediately re-closing the popover
  // when pointer events from the closing add-tag popover propagate through.
  const suppressDismissRef = useRef(false)

  // Sync draft when parent comment changes
  useEffect(() => { setDraft(comment || '') }, [comment])

  // Auto-open comment popover when requested (e.g. right after tag creation).
  useEffect(() => {
    if (!autoOpen || !canComment) return
    const t = setTimeout(() => {
      suppressDismissRef.current = true          // start grace period
      setCommentOpen(true)
      onCommentPopoverOpened?.()
      // Clear grace period after pointer-event propagation has settled
      setTimeout(() => { suppressDismissRef.current = false }, 400)
    }, 100)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen])

  useEffect(() => {
    if (commentOpen) setTimeout(() => textareaRef.current?.focus(), 50)
  }, [commentOpen])

  const handleSave = () => {
    onCommentSave(tag, draft)
    setCommentOpen(false)
  }

  const badgeEl = (
    <span
      style={{
        backgroundColor: color.bg,
        color: color.text,
        // Slightly thicker border when a comment is attached so it reads as "annotated"
        border: comment
          ? `1.5px solid ${color.border}`
          : `1px solid ${color.border}`,
        cursor: canComment ? 'pointer' : 'default',
      }}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium select-none"
      onClick={e => { if (canComment) { e.stopPropagation(); setCommentOpen(true) } }}
    >
      {tag}
      {/* Comment indicator dot */}
      {comment && (
        <MessageSquare
          style={{ color: color.text }}
          className="w-2.5 h-2.5 ml-0.5 opacity-70 shrink-0"
        />
      )}
      <button
        onClick={e => { e.stopPropagation(); onRemove(tag) }}
        style={{ color: color.text }}
        className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity rounded-full"
        aria-label={`Remove tag ${tag}`}
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  )

  // Wrap in tooltip to surface the annotation text on hover
  const badge = comment ? (
    <Tooltip>
      <TooltipTrigger asChild>{badgeEl}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        <div className="flex items-start gap-1.5">
          <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 opacity-70" />
          <span className="whitespace-pre-wrap">{comment}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  ) : badgeEl

  if (!canComment) return badge

  // For admin/owner: wrap trigger in a tooltip (shows existing annotation on hover)
  // then Popover opens on click for editing.
  const triggerEl = comment ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <PopoverTrigger asChild>{badgeEl}</PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        <div className="flex items-start gap-1.5">
          <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 opacity-70" />
          <span className="whitespace-pre-wrap">{comment}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  ) : (
    <PopoverTrigger asChild>{badgeEl}</PopoverTrigger>
  )

  return (
    <Popover open={commentOpen} onOpenChange={setCommentOpen}>
      {triggerEl}
      <PopoverContent
        className="w-64 p-3 shadow-lg"
        align="start"
        side="bottom"
        onClick={e => e.stopPropagation()}
        onInteractOutside={e => {
          if (suppressDismissRef.current) e.preventDefault()
        }}
      >
        <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground font-medium">
          <MessageSquare className="w-3 h-3" />
          <span>Annotation for <strong>&ldquo;{tag}&rdquo;</strong></span>
        </div>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={`e.g. "0:14 - word not transcribed"`}
          rows={3}
          className={cn(
            'w-full resize-none rounded-md border border-input bg-background px-2 py-1.5',
            'text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            'mb-2'
          )}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
            if (e.key === 'Escape') setCommentOpen(false)
          }}
        />
        <div className="flex justify-between items-center gap-2">
          {comment && (
            <button
              className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => { onCommentSave(tag, ''); setCommentOpen(false) }}
            >
              Clear
            </button>
          )}
          <div className="flex gap-1.5 ml-auto">
            <button
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
              onClick={() => setCommentOpen(false)}
            >
              Cancel
            </button>
            <button
              className="text-[11px] bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90 transition-opacity"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">⌘ Enter to save</p>
      </PopoverContent>
    </Popover>
  )
}

// Colour dot shown next to a suggestion row in the popover
const TagDot: React.FC<{ tag: string }> = ({ tag }) => {
  const color = useTagColor(tag)
  return (
    <span
      style={{ backgroundColor: color.bg, border: `1px solid ${color.border}` }}
      className="w-2 h-2 rounded-full shrink-0"
    />
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface TagEditorProps {
  callId: string
  initialTags: string[]
  initialTagComments?: Record<string, string>
  availableTags: string[]
  /** When true, clicking a tag badge opens a comment editor */
  canComment?: boolean
  onUpdated?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export const TagEditor: React.FC<TagEditorProps> = ({
  callId,
  initialTags,
  initialTagComments = {},
  availableTags,
  canComment = false,
  onUpdated,
}) => {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [tagComments, setTagComments] = useState<Record<string, string>>(initialTagComments)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [justAddedTag, setJustAddedTag] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // No prop-sync useEffects here intentionally — local state is the source of
  // truth after mount. Syncing from props on every parent refetch was causing
  // the "disappear then reappear" flicker. The component resets naturally when
  // React unmounts/remounts it (key change on callId).

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const persistTags = useCallback(async (nextTags: string[], prevTags: string[]) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/logs/call-logs/${callId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags }),
      })
      if (!res.ok) throw new Error(await res.text())
      // No refetch — local state is already correct; refetching caused the flicker
    } catch (err) {
      console.error('Failed to save tags:', err)
      setTags(prevTags)   // revert to pre-save snapshot, not stale initialTags
    } finally {
      setSaving(false)
    }
  }, [callId])

  const persistComment = useCallback(async (
    nextComments: Record<string, string>,
    prevComments: Record<string, string>
  ) => {
    try {
      const res = await fetch(`/api/logs/call-logs/${callId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagComments: nextComments }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (err) {
      console.error('Failed to save tag comment:', err)
      setTagComments(prevComments)  // revert to pre-save snapshot
    }
  }, [callId])

  // Wrapper called by TagBadge with (tag, comment string)
  const handleCommentSave = useCallback((tag: string, comment: string) => {
    const prev = tagComments
    const next = { ...tagComments }
    if (comment.trim()) {
      next[tag] = comment.trim()
    } else {
      delete next[tag]
    }
    setTagComments(next)
    persistComment(next, prev)
  }, [tagComments, persistComment])

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || tags.includes(trimmed)) return
    const prev = tags
    const next = [...tags, trimmed]
    setTags(next)
    persistTags(next, prev)
    setInput('')
    setOpen(false)
    if (canComment) setJustAddedTag(trimmed)
  }, [tags, persistTags, canComment])

  const removeTag = useCallback((tag: string) => {
    const prev = tags
    const next = tags.filter(t => t !== tag)
    setTags(next)
    persistTags(next, prev)
  }, [tags, persistTags])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(input) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  const suggestions = availableTags.filter(
    t => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  )

  return (
    <div
      className="flex flex-wrap items-center gap-1 min-w-[120px] max-w-[280px]"
      onClick={e => e.stopPropagation()}
    >
      {tags.map(tag => (
        <TagBadge
          key={tag}
          tag={tag}
          comment={tagComments[tag]}
          canComment={canComment}
          autoOpen={canComment && justAddedTag === tag}
          onCommentPopoverOpened={() => setJustAddedTag(null)}
          onRemove={removeTag}
          onCommentSave={handleCommentSave}
        />
      ))}

      {/* Add tag trigger + popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium',
              'border border-dashed border-gray-300 dark:border-gray-600',
              'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
              'hover:border-gray-400 dark:hover:border-gray-400 transition-colors select-none',
              saving && 'opacity-40 pointer-events-none'
            )}
            aria-label="Add tag"
          >
            <Plus className="w-2.5 h-2.5" />
            {tags.length === 0 && <span>Add tag</span>}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-56 p-2 shadow-lg"
          align="start"
          side="bottom"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground font-medium">
            <Tag className="w-3 h-3" />
            <span>Add tag</span>
          </div>

          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type and press Enter…"
            className="h-7 text-xs mb-2"
          />

          {input.trim() && !availableTags.includes(input.trim()) && (
            <button
              className="w-full text-left px-2 py-1 rounded text-xs hover:bg-accent transition-colors flex items-center gap-1.5 mb-1"
              onClick={() => addTag(input)}
            >
              <Plus className="w-3 h-3 text-muted-foreground" />
              <span>Create <strong>&ldquo;{input.trim()}&rdquo;</strong></span>
            </button>
          )}

          {suggestions.length > 0 && (
            <div className="relative">
              <p className="text-[10px] text-muted-foreground mb-1 px-1">
                {suggestions.length} tag{suggestions.length !== 1 ? 's' : ''}
                {input.trim() ? ' matching' : ' available'}
              </p>
              <div
                style={{ maxHeight: '130px', overflowY: 'auto', scrollbarWidth: 'thin' }}
                className="space-y-0.5 pr-0.5"
              >
                {suggestions.map(tag => (
                  <button
                    key={tag}
                    className="w-full text-left px-2 py-1 rounded text-xs hover:bg-accent transition-colors flex items-center gap-1.5"
                    onClick={() => addTag(tag)}
                  >
                    <TagDot tag={tag} />
                    {tag}
                  </button>
                ))}
              </div>
              {suggestions.length > 5 && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-5 pointer-events-none rounded-b"
                  style={{ background: 'linear-gradient(to top, var(--popover), transparent)' }}
                />
              )}
            </div>
          )}

          {suggestions.length === 0 && !input.trim() && availableTags.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-2">
              No tags yet — type to create one
            </p>
          )}

          {canComment && (
            <p className="text-[10px] text-muted-foreground mt-2 px-1 border-t border-border pt-2">
              {tags.length > 0
                ? 'Click any tag badge to annotate it'
                : 'Adding a tag will prompt for an annotation'}
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
