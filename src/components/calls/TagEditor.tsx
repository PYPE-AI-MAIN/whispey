'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Plus, X, Tag } from 'lucide-react'
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
  // Indigo — calm and neutral, good anchor colour
  {
    light: { bg: '#EEF2FF', text: '#3730A3', border: '#A5B4FC' },
    dark:  { bg: 'rgba(79,70,229,0.18)', text: '#A5B4FC', border: 'rgba(129,120,254,0.45)' },
  },
  // Emerald — positive / success feel
  {
    light: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
    dark:  { bg: 'rgba(16,185,129,0.18)', text: '#6EE7B7', border: 'rgba(52,211,153,0.45)' },
  },
  // Violet — premium / highlight
  {
    light: { bg: '#EDE9FE', text: '#5B21B6', border: '#C4B5FD' },
    dark:  { bg: 'rgba(139,92,246,0.18)', text: '#C4B5FD', border: 'rgba(167,139,250,0.45)' },
  },
  // Amber — caution / attention
  {
    light: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
    dark:  { bg: 'rgba(245,158,11,0.18)', text: '#FCD34D', border: 'rgba(251,191,36,0.45)' },
  },
  // Rose — urgent / negative
  {
    light: { bg: '#FFE4E6', text: '#9F1239', border: '#FECDD3' },
    dark:  { bg: 'rgba(225,29,72,0.18)',  text: '#FDA4AF', border: 'rgba(253,164,175,0.45)' },
  },
  // Sky — informational / neutral-cool
  {
    light: { bg: '#E0F2FE', text: '#0C4A6E', border: '#7DD3FC' },
    dark:  { bg: 'rgba(14,165,233,0.18)', text: '#7DD3FC', border: 'rgba(56,189,248,0.45)' },
  },
  // Orange — warm / action
  {
    light: { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' },
    dark:  { bg: 'rgba(249,115,22,0.18)', text: '#FDBA74', border: 'rgba(251,146,60,0.45)' },
  },
  // Teal — secondary / data
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
// Isolated so each badge can call the hook (hooks must be called at component level)
const TagBadge: React.FC<{ tag: string; onRemove: (tag: string) => void }> = ({ tag, onRemove }) => {
  const color = useTagColor(tag)
  return (
    <span
      style={{
        backgroundColor: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
      }}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium select-none"
    >
      {tag}
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
interface TagEditorProps {
  callId: string
  initialTags: string[]
  availableTags: string[]   // all tags seen across other calls (for suggestions)
  onUpdated?: () => void    // called after a successful server write
}

// ─── Component ────────────────────────────────────────────────────────────────
export const TagEditor: React.FC<TagEditorProps> = ({
  callId,
  initialTags,
  availableTags,
  onUpdated,
}) => {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // keep in sync if parent re-renders with fresh data
  useEffect(() => {
    setTags(initialTags)
  }, [initialTags])

  // focus input when popover opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const persist = useCallback(async (nextTags: string[]) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/logs/call-logs/${callId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags }),
      })
      if (!res.ok) throw new Error(await res.text())
      onUpdated?.()
    } catch (err) {
      console.error('Failed to save tags:', err)
      setTags(initialTags)   // revert optimistic update on failure
    } finally {
      setSaving(false)
    }
  }, [callId, initialTags, onUpdated])

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || tags.includes(trimmed)) return
    const next = [...tags, trimmed]
    setTags(next)
    persist(next)
    setInput('')
  }, [tags, persist])

  const removeTag = useCallback((tag: string) => {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    persist(next)
  }, [tags, persist])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const suggestions = availableTags.filter(
    t => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  )

  return (
    <div
      className="flex flex-wrap items-center gap-1 min-w-[120px] max-w-[280px]"
      onClick={e => e.stopPropagation()}
    >
      {/* Existing tag badges */}
      {tags.map(tag => (
        <TagBadge key={tag} tag={tag} onRemove={removeTag} />
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

          {/* Create option when the typed text isn't an existing suggestion */}
          {input.trim() && !availableTags.includes(input.trim()) && (
            <button
              className="w-full text-left px-2 py-1 rounded text-xs hover:bg-accent transition-colors flex items-center gap-1.5 mb-1"
              onClick={() => addTag(input)}
            >
              <Plus className="w-3 h-3 text-muted-foreground" />
              <span>Create <strong>&ldquo;{input.trim()}&rdquo;</strong></span>
            </button>
          )}

          {/* Suggestions from tags already used on other calls */}
          {suggestions.length > 0 && (
            <div className="relative">
              {/* Count label */}
              <p className="text-[10px] text-muted-foreground mb-1 px-1">
                {suggestions.length} tag{suggestions.length !== 1 ? 's' : ''}
                {input.trim() ? ' matching' : ' available'}
              </p>

              {/*
                Inline styles for max-height + overflow — Tailwind arbitrary values
                can lose to Radix UI's popper wrapper in v4. Inline styles always win.
                130px ≈ 5 rows, so the 6th tag onwards scrolls.
              */}
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

              {/* Bottom fade — visual cue that more items exist below */}
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
        </PopoverContent>
      </Popover>
    </div>
  )
}
