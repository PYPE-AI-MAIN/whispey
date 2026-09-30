'use client'

import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CallLog } from '@/types/logs'

export interface TurnPreview {
  /** Stable key for rendering — the live transcript segment id, or derived once when a saved call is normalised. */
  id: string
  speaker: 'agent' | 'user'
  text: string
}

export type LastCallState =
  | { status: 'loading' }
  | { status: 'idle' }
  // `turns` is the live transcript captured during the call, so the person keeps
  // seeing the conversation while the saved record catches up.
  | { status: 'waiting'; turns: TurnPreview[] }
  | { status: 'ready'; call: CallLog }
  | { status: 'timeout'; turns: TurnPreview[] }

// transcription_metrics is NOT turn data — it's the Field Extractor's
// output (an arbitrary {key: value} map, see OutputVariablesPanel). The
// actual conversation lives in transcript_json ({role, content}[]).
function normalizeTranscript(call: CallLog): TurnPreview[] {
  if (!Array.isArray(call.transcript_json)) return []
  const turns: TurnPreview[] = []
  call.transcript_json.forEach((item: any, position: number) => {
    const raw = Array.isArray(item?.content)
      ? item.content.join(' ')
      : (item?.content ?? item?.user_transcript ?? item?.agent_response ?? '')
    const text = String(raw ?? '')
    // Skip empty turns and lone-punctuation artifacts (e.g. a stray ".").
    if (!/[\p{L}\p{N}]/u.test(text)) return
    turns.push({
      id: `${call.id}-${position}`,
      speaker: item?.role === 'assistant' ? 'agent' : 'user',
      text,
    })
  })
  return turns
}

function formatDuration(seconds?: number | null) {
  if (!seconds && seconds !== 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// Fills the stage (its parent is a flex column): the header stays put and only
// the transcript scrolls, so nothing — including the end of a long call — ever
// sits below a fold inside a nested scroller.
function TranscriptCard({
  turns, meta, href, chip, emptyText,
}: Readonly<{
  turns: TurnPreview[]
  meta?: string[]
  href?: string
  chip?: React.ReactNode
  emptyText: string
}>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-left dark:border-gray-800 dark:bg-gray-800/40">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-2.5 dark:border-gray-800">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Last call
          </span>
          {meta && meta.length > 0 && (
            <span className="truncate text-[11px] text-gray-400 dark:text-gray-500">{meta.join(' · ')}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {chip}
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View full details"
              title="View full details"
              className="flex cursor-pointer items-center justify-center rounded p-1 text-gray-400 transition hover:bg-white hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {turns.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">{emptyText}</p>
      ) : (
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          {turns.map((t) => (
            <div key={t.id} className={cn('flex flex-col', t.speaker === 'user' ? 'items-end' : 'items-start')}>
              <span className="mb-0.5 px-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t.speaker === 'user' ? 'You' : 'Agent'}
              </span>
              <p
                style={{ maxWidth: '85%' }}
                className={cn(
                  'rounded-2xl px-3 py-1.5 text-[13px] leading-relaxed',
                  t.speaker === 'user'
                    ? 'rounded-br-md bg-blue-600 text-white'
                    : 'rounded-bl-md bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-100'
                )}
              >
                {t.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LastCallCard({
  state,
  observabilityHref,
  onRetry,
}: Readonly<{
  state: LastCallState
  observabilityHref?: string
  onRetry?: () => void
}>) {
  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-center dark:border-gray-800 dark:bg-gray-800/40">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    )
  }

  if (state.status === 'waiting') {
    return (
      <TranscriptCard
        turns={state.turns}
        emptyText="Saving your call…"
        chip={
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving call…
          </span>
        }
      />
    )
  }

  if (state.status === 'timeout') {
    return (
      <TranscriptCard
        turns={state.turns}
        emptyText="This call hasn't shown up yet — it will appear in Call Logs shortly."
        chip={
          onRetry ? (
            <button
              onClick={onRetry}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 transition hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RefreshCw className="h-3 w-3" /> Check again
            </button>
          ) : undefined
        }
      />
    )
  }

  if (state.status !== 'ready') return null

  const { call } = state
  const turns = normalizeTranscript(call)
  const duration = formatDuration(call.duration_seconds)
  const reason = call.call_ended_reason?.replaceAll('_', ' ')
  const turnCount = turns.length > 0 ? `${turns.length} turns` : null
  const meta = [duration, turnCount, reason].filter(Boolean) as string[]

  return (
    <TranscriptCard
      turns={turns}
      meta={meta}
      href={observabilityHref}
      emptyText="No transcript available for this call."
    />
  )
}
