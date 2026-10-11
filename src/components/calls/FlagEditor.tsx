'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Flag, X, Pencil, Trash2, Plus, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeFlags, type FlagEntry } from '@/utils/callLogsUtils'

export type { FlagEntry } from '@/utils/callLogsUtils'

export interface FlagEditorProps {
  callId: string
  initialFlag?: unknown
  /** Current signed-in user's Clerk id — used to tell which flags they authored */
  currentUserId?: string | null
  currentUserEmail?: string | null
  /** Admin/owner: can delete anyone's flag. Viewers can only delete their own. */
  canDeleteAnyFlag?: boolean
  onUpdated?: () => void
  /** 'quiet' is the redesigned Call Logs look: a soft pill naming the flag, and
   *  the "Flag" button only shows on row hover. */
  variant?: 'default' | 'quiet' | 'icon'
}

type FlagApiAction =
  | { action: 'add'; text: string }
  | { action: 'update'; flagId: string; text: string }
  | { action: 'delete'; flagId: string }

const pluralizeFlags = (count: number, noun = 'flag'): string => `${count} ${noun}${count === 1 ? '' : 's'}`

interface FlagListItemProps {
  flag: FlagEntry
  isAuthor: boolean
  canDelete: boolean
  isBeingEdited: boolean
  copied: boolean
  onCopyEmail: (email: string) => void
  onEdit: () => void
  onDelete: () => void
}

// One flag entry inside the popover's list — its own component so the parent's
// render logic (which flag is open in the tooltip, which is being edited, the
// composer) doesn't also have to carry this row's author/permission branching.
const FlagListItem: React.FC<FlagListItemProps> = ({
  flag, isAuthor, canDelete, isBeingEdited, copied, onCopyEmail, onEdit, onDelete,
}) => {
  const email = flag.flagged_by?.email
  return (
    <li
      className={cn(
        'group rounded-md border p-2 transition-colors',
        isBeingEdited ? 'border-rose-400/50 bg-rose-500/5' : 'border-border/60 bg-muted/25 hover:bg-muted/40'
      )}
    >
      <p className="whitespace-pre-wrap text-xs leading-snug text-foreground">{flag.text}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
          <span className="truncate">{email ?? 'Unknown'}</span>
          {email && (
            <button
              aria-label="Copy email"
              onClick={() => onCopyEmail(email)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
            </button>
          )}
          <span className="shrink-0">· {formatRelativeTime(flag.flagged_at)}</span>
        </div>
        {(isAuthor || canDelete) && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
            {isAuthor && (
              <button
                aria-label="Edit flag"
                onClick={onEdit}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {canDelete && (
              <button
                aria-label="Remove flag"
                onClick={onDelete}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

interface FlagTooltipListProps {
  flags: FlagEntry[]
  copiedId: string | null
  onCopyEmail: (flagEntry: FlagEntry, email: string) => void
}

// The trigger's hover tooltip when the call is flagged: every flag with its author.
const FlagTooltipList: React.FC<FlagTooltipListProps> = ({ flags, copiedId, onCopyEmail }) => (
  <div className="flex flex-col gap-2 max-w-[260px] max-h-32 overflow-y-auto py-0.5 pr-0.5">
    {flags.map(f => (
      <div key={f.id} className="flex items-start gap-2">
        <Flag className="w-3 h-3 mt-0.5 shrink-0 text-rose-400" style={{ fill: 'currentColor' }} />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="whitespace-pre-wrap text-xs leading-snug">{f.text}</span>
          {f.flagged_by?.email && (
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[10px] text-muted-foreground truncate">{f.flagged_by.email}</span>
              <button
                aria-label="Copy email"
                onClick={(e) => { e.stopPropagation(); onCopyEmail(f, f.flagged_by!.email) }}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedId === f.id ? (
                  <Check className="w-2.5 h-2.5 text-emerald-500" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    ))}
    <span className="text-[10px] font-medium text-rose-400 pt-0.5 border-t border-rose-400/20">
      Click to view or add another flag
    </span>
  </div>
)

interface FlagTriggerState {
  iconOnly: boolean
  quiet: boolean
  isFlagged: boolean
  open: boolean
  saving: boolean
  flags: FlagEntry[]
}

// The popover trigger's label, classes and content for each look: the bare icon
// (call list), the flagged pill, or the dashed "Flag" pill.
function flagTriggerLook({ iconOnly, quiet, isFlagged, open, saving, flags }: FlagTriggerState): {
  label: string
  className: string
  content: React.ReactNode
} {
  if (iconOnly) {
    return {
      label: isFlagged ? `View ${pluralizeFlags(flags.length)}` : 'Add flag',
      className: cn(
        'grid h-5 w-5 shrink-0 place-items-center rounded-full transition cursor-pointer',
        isFlagged
          ? 'text-[var(--cl-red)] hover:bg-[var(--cl-red-soft)]'
          : cn('text-[var(--cl-text3)] hover:bg-[var(--cl-red-soft)] hover:text-[var(--cl-red-text)]', !open && 'opacity-0 group-hover:opacity-100'),
        saving && 'opacity-40 pointer-events-none'
      ),
      content: <Flag className="h-3.5 w-3.5" style={isFlagged ? { fill: 'currentColor' } : undefined} />,
    }
  }
  if (isFlagged) {
    // Flagged — solid red pill; a count beyond 1 rides as a small badge
    // in the corner instead of inline text, so the pill never wraps.
    return {
      label: `View ${pluralizeFlags(flags.length)}`,
      className: cn(
        quiet
          ? 'relative inline-flex max-w-[140px] shrink-0 items-center gap-1 rounded-full border border-[var(--cl-red-line)] bg-[var(--cl-red-soft)] px-2 py-px text-[11.5px] text-[var(--cl-red-text)] whitespace-nowrap select-none transition cursor-pointer hover:brightness-110'
          : cn(
              'relative inline-flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap select-none transition-all cursor-pointer',
              'bg-rose-600 text-white border border-rose-700',
              'hover:bg-rose-700 active:scale-95'
            ),
        saving && 'opacity-40 pointer-events-none'
      ),
      content: (
        <>
          <Flag className="w-2.5 h-2.5 shrink-0" style={{ fill: 'currentColor' }} />
          {/* The quiet pill names what was flagged; the full list is in the tooltip. */}
          <span className={cn(quiet && 'truncate')}>{quiet ? (flags[0]?.text || 'Flagged') : 'Flagged'}</span>
          {flags.length > 1 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-rose-600 shadow-sm ring-1 ring-rose-700/20">
              {flags.length}
            </span>
          )}
        </>
      ),
    }
  }
  // Unflagged — dashed pill, turns rose-red on hover
  return {
    label: 'Add flag',
    className: cn(
      quiet
        ? cn(
            'inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--cl-border2)] px-2 py-px text-[12px] text-[var(--cl-text3)] select-none transition cursor-pointer',
            'hover:border-[var(--cl-red-line)] hover:text-[var(--cl-red-text)]',
            !open && 'opacity-0 group-hover:opacity-100'
          )
        : cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium select-none transition-all cursor-pointer',
            'border border-dashed border-gray-300 dark:border-gray-600',
            'text-gray-400 dark:text-gray-500',
            'hover:border-rose-400 hover:text-rose-500 dark:hover:border-rose-500 dark:hover:text-rose-400 active:scale-95'
          ),
      saving && 'opacity-40 pointer-events-none'
    ),
    content: (
      <>
        <Flag className="w-2.5 h-2.5 shrink-0" />
        <span>Flag</span>
      </>
    ),
  }
}

interface FlagComposerProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  draft: string
  editingId: string | null
  isFlagged: boolean
  saving: boolean
  onDraftChange: (draft: string) => void
  onCancelEdit: () => void
  onSubmit: () => void
  onClose: () => void
}

// The popover's textarea for adding a new flag or editing one of your own.
const FlagComposer: React.FC<FlagComposerProps> = ({
  textareaRef, draft, editingId, isFlagged, saving, onDraftChange, onCancelEdit, onSubmit, onClose,
}) => (
  <div className={cn('px-3 pb-3 pt-2', isFlagged && !editingId && 'border-t border-border/60')}>
    {(editingId || isFlagged) && (
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium">
        <span className={editingId ? 'text-rose-500' : 'text-muted-foreground'}>
          {editingId ? 'Editing your flag' : 'Add another flag'}
        </span>
        {editingId && (
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={onCancelEdit}
          >
            Cancel
          </button>
        )}
      </div>
    )}
    <textarea
      ref={textareaRef}
      value={draft}
      onChange={e => onDraftChange(e.target.value)}
      placeholder={`e.g. "Response at 2:30 was incorrect"`}
      rows={3}
      className={cn(
        'w-full resize-none rounded-md border border-input bg-background px-2.5 py-2',
        'text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
      )}
      onKeyDown={e => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit()
        if (e.key === 'Escape') onClose()
      }}
    />
    <div className="mt-1.5 flex items-center justify-between">
      <p className="text-[10px] text-muted-foreground">⌘ Enter to submit</p>
      <button
        disabled={!draft.trim() || saving}
        className={cn(
          'inline-flex items-center gap-1 text-[11px] font-medium bg-rose-600 text-white px-2 py-1 rounded hover:bg-rose-700 transition-colors',
          (!draft.trim() || saving) && 'opacity-40 cursor-not-allowed'
        )}
        onClick={onSubmit}
      >
        {editingId ? 'Save' : <><Plus className="w-3 h-3" /> Add flag</>}
      </button>
    </div>
  </div>
)

// Short, human timestamp — "Just now" / "5m ago" / "3h ago" / falls back to a date once it's old.
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export const FlagEditor: React.FC<FlagEditorProps> = ({
  callId,
  initialFlag,
  currentUserId,
  currentUserEmail,
  canDeleteAnyFlag = true,
  onUpdated,
  variant = 'default',
}) => {
  // 'icon' is the call list beside an open call: just a flag icon (filled when
  // flagged, on hover otherwise); the popover is the same.
  const iconOnly = variant === 'icon'
  const quiet = variant === 'quiet' || iconOnly
  const [flags, setFlags] = useState<FlagEntry[]>(() => normalizeFlags(initialFlag))
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // No prop-sync useEffect — local state is the source of truth after mount.

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50)
  }, [open, editingId])

  const call = useCallback(async (body: FlagApiAction) => {
    const res = await fetch(`/api/logs/call-logs/${callId}/flag`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return await res.json() as { flags: FlagEntry[]; qaPath?: string | null }
  }, [callId])

  const handleAdd = async () => {
    const text = draft.trim()
    if (!text) return
    const prevFlags = flags
    // Optimistic entry — replaced by the server's copy (with a real id) once it lands.
    const optimistic: FlagEntry = {
      id: `optimistic-${Date.now()}`,
      text,
      flagged_at: new Date().toISOString(),
      flagged_by: currentUserId ? { userId: currentUserId, email: currentUserEmail ?? '' } : undefined,
    }
    setFlags([...prevFlags, optimistic])
    setDraft('')
    setSaving(true)
    try {
      const { flags: next, qaPath } = await call({ action: 'add', text })
      setFlags(next)
      onUpdated?.()
      toast.success(
        <span>
          Flagged. Our QA team will review it.{' '}
          {qaPath && <Link href={qaPath} className="font-medium underline underline-offset-2">Check the status here</Link>}
        </span>,
        { duration: 8000 },
      )
    } catch (err) {
      console.error('Failed to add flag:', err)
      setFlags(prevFlags)
      setDraft(text)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (flagId: string) => {
    const text = draft.trim()
    if (!text) return
    const prevFlags = flags
    setFlags(prevFlags.map(f => (f.id === flagId ? { ...f, text } : f)))
    setEditingId(null)
    setDraft('')
    setSaving(true)
    try {
      const { flags: next } = await call({ action: 'update', flagId, text })
      setFlags(next)
      onUpdated?.()
    } catch (err) {
      console.error('Failed to update flag:', err)
      setFlags(prevFlags)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (flagId: string) => {
    const prevFlags = flags
    setFlags(prevFlags.filter(f => f.id !== flagId))
    setSaving(true)
    try {
      const { flags: next } = await call({ action: 'delete', flagId })
      setFlags(next)
      onUpdated?.()
    } catch (err) {
      console.error('Failed to remove flag:', err)
      setFlags(prevFlags)
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (flagEntry: FlagEntry) => {
    setEditingId(flagEntry.id)
    setDraft(flagEntry.text)
  }

  const startAdding = () => {
    setEditingId(null)
    setDraft('')
  }

  const handleCopyEmail = (flagEntry: FlagEntry, email: string) => {
    navigator.clipboard.writeText(email)
    setCopiedId(flagEntry.id)
    setTimeout(() => setCopiedId(id => (id === flagEntry.id ? null : id)), 1500)
  }

  const isFlagged = flags.length > 0
  const headerLabel = isFlagged ? pluralizeFlags(flags.length, 'Flag') : 'Report an issue'

  // ── Tooltip message ────────────────────────────────────────────────────────
  const tooltipContent = isFlagged
    ? <FlagTooltipList flags={flags} copiedId={copiedId} onCopyEmail={handleCopyEmail} />
    : <span className="text-xs">Report an issue in this call</span>

  const trigger = flagTriggerLook({ iconOnly, quiet, isFlagged, open, saving, flags })

  // Stop these clicks from bubbling to an ancestor row's own onClick — applied on each
  // real interactive button below rather than a wrapping div, so there's no non-native
  // element with a click handler for accessibility tooling to flag.
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div className="inline-flex items-center gap-1">
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
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) startAdding() }}>
        {/* open={false} while the popover is open — no point hovering a tooltip over
            a trigger whose full detail is already showing right below it. */}
        <Tooltip open={open ? false : undefined}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                aria-label={trigger.label}
                disabled={saving}
                onClick={stop}
                className={trigger.className}
              >
                {trigger.content}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="pointer-events-auto bg-white text-gray-900 border border-gray-200 shadow-lg dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
          >
            {tooltipContent}
          </TooltipContent>
        </Tooltip>

        {/* Standalone "+" — visible next to the badge at all times, so it's obvious
            more flags can always be added without first opening the list. Mirrors
            TagEditor's separate "Add tag" pill next to existing tag chips. */}
        {isFlagged && !iconOnly && (
          <button
            aria-label="Add another flag"
            disabled={saving}
            onClick={(e) => { stop(e); startAdding(); setOpen(true) }}
            className={cn(
              'inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full select-none transition-all cursor-pointer',
              'border border-dashed border-gray-300 dark:border-gray-600',
              'text-gray-400 dark:text-gray-500',
              'hover:border-rose-400 hover:text-rose-500 dark:hover:border-rose-500 dark:hover:text-rose-400 active:scale-95',
              quiet && 'opacity-0 group-hover:opacity-100',
              saving && 'opacity-40 pointer-events-none'
            )}
          >
            <Plus className="w-3 h-3" />
          </button>
        )}

        <PopoverContent
          className="w-72 max-w-[calc(100vw-2rem)] p-0 shadow-lg overflow-hidden"
          align="start"
          side="bottom"
          collisionPadding={16}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Flag className="w-3 h-3 text-rose-500 shrink-0" style={{ fill: 'currentColor' }} />
              <span>{headerLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Existing flags */}
          {flags.length > 0 && (
            <ul className="flex flex-col gap-1.5 max-h-28 overflow-y-auto px-3 pt-2">
              {flags.map(f => {
                const isAuthor = Boolean(currentUserId) && f.flagged_by?.userId === currentUserId
                return (
                  <FlagListItem
                    key={f.id}
                    flag={f}
                    isAuthor={isAuthor}
                    canDelete={isAuthor || canDeleteAnyFlag}
                    isBeingEdited={editingId === f.id}
                    copied={copiedId === f.id}
                    onCopyEmail={(email) => handleCopyEmail(f, email)}
                    onEdit={() => startEditing(f)}
                    onDelete={() => handleDelete(f.id)}
                  />
                )
              })}
            </ul>
          )}

          {/* Composer */}
          <FlagComposer
            textareaRef={textareaRef}
            draft={draft}
            editingId={editingId}
            isFlagged={isFlagged}
            saving={saving}
            onDraftChange={setDraft}
            onCancelEdit={startAdding}
            onSubmit={() => (editingId ? handleUpdate(editingId) : handleAdd())}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
