'use client'

import { useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { Bot, Building2, Check, Copy, ExternalLink, Globe, Sparkles, Trash2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { V2_BTN, V2_THEME } from '@/components/calls/v2/theme'
import { SOURCE_LABEL, callTraceHref, callerQuote, formatPhone, type DncEntry } from './dncShared'

/** Who a number is blocked for, as a chip. */
function BlockedFor({ entry }: Readonly<{ entry: DncEntry }>) {
  if (entry.scope === 'global') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
        <Globe className="h-3.5 w-3.5 text-[var(--cl-red)]" /> Everyone
      </span>
    )
  }
  if (entry.scope === 'agent') {
    return (
      <span className="flex min-w-0 flex-col">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
          <Bot className="h-3.5 w-3.5 shrink-0 text-[var(--cl-accent)]" />
          <span className="truncate">{entry.agent_name ?? 'Deleted agent'}</span>
        </span>
        <span className="truncate pl-5 text-[12px] text-[var(--cl-text3)]">{entry.project_name ?? '—'}</span>
      </span>
    )
  }
  return (
    <span className="flex min-w-0 flex-col">
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--cl-text2)]" />
        <span className="truncate">{entry.project_name ?? 'Deleted organization'}</span>
      </span>
      <span className="pl-5 text-[12px] text-[var(--cl-text3)]">Every agent</span>
    </span>
  )
}

function SourceChip({ source }: Readonly<{ source: DncEntry['source'] }>) {
  if (source === 'auto') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--cl-violet-line)] bg-[var(--cl-violet-soft)] px-1.5 py-0.5 text-[11.5px] font-medium text-[var(--cl-violet-text)]">
        <Sparkles className="h-3 w-3" /> {SOURCE_LABEL.auto}
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-md border border-[var(--cl-border)] bg-[var(--cl-panel2)] px-1.5 py-0.5 text-[11.5px] font-medium text-[var(--cl-text2)]">
      {SOURCE_LABEL[source] ?? source}
    </span>
  )
}

function Reason({ entry }: Readonly<{ entry: DncEntry }>) {
  const quote = callerQuote(entry.reason)
  if (quote) {
    return (
      <span className="line-clamp-2 text-[13px] italic text-[var(--cl-text2)]" title={quote}>
        “{quote}”
      </span>
    )
  }
  if (!entry.reason) return <span className="text-[var(--cl-text3)]">—</span>
  return (
    <span className="line-clamp-2 text-[13px] text-[var(--cl-text2)]" title={entry.reason}>
      {entry.reason}
    </span>
  )
}

function CopyNumber({ value }: Readonly<{ value: string }>) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      aria-label={`Copy ${value}`}
      className="rounded p-0.5 text-[var(--cl-text3)] opacity-0 transition-opacity hover:text-[var(--cl-text)] focus-visible:opacity-100 group-hover:opacity-100"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

/** Remove, after a one-click confirm that says what removing means. */
function RemoveButton({ entry, onRemove, busy }: Readonly<{ entry: DncEntry; onRemove: (id: string) => void; busy: boolean }>) {
  const [open, setOpen] = useState(false)
  let whoCanCall = 'every agent'
  if (entry.scope === 'agent') whoCanCall = entry.agent_name ?? 'this agent'
  else if (entry.scope === 'project') whoCanCall = `agents in ${entry.project_name ?? 'this organization'}`
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Remove ${entry.phone_e164} from the DNC list`}
          title="Remove from the list"
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--cl-text3)] transition-colors hover:bg-[var(--cl-red-soft)] hover:text-[var(--cl-red)]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className={cn('w-72 rounded-xl border-[var(--cl-border)] bg-[var(--cl-raised)] p-3 text-[var(--cl-text)]', V2_THEME)}>
        <p className="text-[13px] font-medium">Remove {formatPhone(entry.phone_e164)}?</p>
        <p className="mt-1 text-[12.5px] text-[var(--cl-text3)]">{whoCanCall} can call this number again.</p>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className={V2_BTN}>Cancel</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onRemove(entry.id)
              setOpen(false)
            }}
            className="inline-flex h-8 items-center rounded-lg bg-[var(--cl-red)] px-3 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

const TH = 'px-4 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[.06em] text-[var(--cl-text3)]'

export function DncTable({ entries, onRemove, removingId }: Readonly<{
  entries: DncEntry[]
  onRemove: (id: string) => void
  removingId: string | null
}>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse">
        <thead className="border-b border-[var(--cl-border)] bg-[var(--cl-panel2)]">
          <tr>
            <th className={TH}>Number</th>
            <th className={TH}>Blocked for</th>
            <th className={TH}>Source</th>
            <th className={cn(TH, 'w-[34%]')}>Reason</th>
            <th className={TH}>Added</th>
            <th className={cn(TH, 'w-20')}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const trace = callTraceHref(e)
            const added = new Date(e.created_at)
            return (
              <tr
                key={e.id}
                className={cn(
                  'group border-b border-[var(--cl-border)] align-middle transition-colors last:border-0 hover:bg-[var(--cl-hover)]',
                  removingId === e.id && 'opacity-40',
                )}
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-mono text-[13.5px] font-medium tabular-nums">{formatPhone(e.phone_e164)}</span>
                    <CopyNumber value={e.phone_e164} />
                  </span>
                </td>
                <td className="max-w-[220px] px-4 py-3"><BlockedFor entry={e} /></td>
                <td className="whitespace-nowrap px-4 py-3"><SourceChip source={e.source} /></td>
                <td className="px-4 py-3"><Reason entry={e} /></td>
                <td className="whitespace-nowrap px-4 py-3" title={added.toLocaleString()}>
                  <span className="block text-[13px]">{formatDistanceToNowStrict(added, { addSuffix: true })}</span>
                  <span className="block max-w-[160px] truncate text-[12px] text-[var(--cl-text3)]" title={e.added_by}>
                    {e.source === 'auto' ? 'automatically' : e.added_by}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="flex items-center justify-end gap-0.5">
                    {trace && (
                      <a
                        href={trace}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open the call where they asked"
                        aria-label="Open the call where they asked"
                        className="grid h-7 w-7 place-items-center rounded-md text-[var(--cl-text3)] transition-colors hover:bg-[var(--cl-accent-soft)] hover:text-[var(--cl-accent)]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <RemoveButton entry={e} onRemove={onRemove} busy={removingId === e.id} />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
