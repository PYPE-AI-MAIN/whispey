"use client"

import React, { useEffect, useRef } from "react"
import { ArrowLeft, Flag, Globe, Info, Phone } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDuration, formatToIndianDateTime, isRowFlaggedForRole, normalizeFlags } from "@/utils/callLogsUtils"
import type { CallLog } from "@/types/logs"
import { cn } from "@/lib/utils"
import { callDurationSeconds, callLabel, callSummary, formatValue, relativeTime, splitTranscriptionMetrics } from "./callData"

interface CallListProps {
  calls: CallLog[]
  openId: string
  role: string | null
  hasSummaryField: boolean
  onOpen: (call: CallLog) => void
  onBack: () => void
  /** Pointer resting on a call — used to start loading it early. */
  onHover?: (call: CallLog) => void
  /** Another page is loading: show placeholders instead of the outgoing page. */
  loading?: boolean
  footer: React.ReactNode
}

// The left pane once a call is open: just enough to pick the next call — who,
// when, how it ended, how long. Everything else sits behind the ⓘ card.
export function CallList({ calls, openId, role, hasSummaryField, onOpen, onBack, onHover, loading = false, footer }: Readonly<CallListProps>) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-call-id="${CSS.escape(openId)}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [openId])

  return (
    <section className="flex min-h-0 min-w-0 flex-col border-r border-[var(--cl-border)] bg-[var(--cl-panel)]">
      <div className="flex flex-none items-center justify-between border-b border-[var(--cl-border)] px-2.5 py-[7px]">
        <button
          type="button"
          onClick={onBack}
          title="Back to the table (Esc)"
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel2)] px-2.5 text-[13px] text-[var(--cl-text2)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Table
        </button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto" aria-busy={loading}>
        {loading ? <ListSkeleton /> : calls.map((call) => (
          <CallListItem
            key={call.id}
            call={call}
            active={call.id === openId}
            role={role}
            hasSummaryField={hasSummaryField}
            onOpen={onOpen}
            onHover={onHover}
          />
        ))}
      </div>
      {footer}
    </section>
  )
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading calls" className="animate-pulse">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="border-b border-[var(--cl-border)] py-3 pl-4 pr-3">
          <div className="flex items-center gap-1.5">
            <span className="h-5 w-5 shrink-0 rounded-full bg-[var(--cl-hover)]" />
            <span className="h-[12px] rounded-full bg-[var(--cl-hover)]" style={{ width: `${55 + ((i * 17) % 25)}%` }} />
            <span className="ml-auto h-[10px] w-12 rounded-full bg-[var(--cl-hover)]" />
          </div>
          <span className="mt-2.5 block h-[10px] w-[38%] rounded-full bg-[var(--cl-hover)]" />
        </div>
      ))}
    </div>
  )
}

function CallListItem({
  call, active, role, hasSummaryField, onOpen, onHover,
}: Readonly<{ call: CallLog; active: boolean; role: string | null; hasSummaryField: boolean; onOpen: (c: CallLog) => void; onHover?: (c: CallLog) => void }>) {
  const label = callLabel(call, role)
  const flagged = isRowFlaggedForRole(call, role)
  const status = call.call_ended_reason || "—"
  const isWeb = !call.customer_number
  return (
    <div
      role="button"
      tabIndex={-1}
      data-call-id={call.id}
      onClick={() => onOpen(call)}
      onMouseEnter={onHover ? () => onHover(call) : undefined}
      className={cn(
        "group relative cursor-pointer border-b border-[var(--cl-border)] py-3 pl-4 pr-3",
        active ? "bg-[var(--cl-accent-soft)]" : "hover:bg-[var(--cl-hover)]"
      )}
    >
      {active && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[var(--cl-accent)]" />}
      <div className="flex items-center gap-1.5">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--cl-hover)] text-[var(--cl-text3)]">
          {isWeb ? <Globe className="h-[11px] w-[11px]" /> : <Phone className="h-[11px] w-[11px]" />}
        </span>
        <span className={cn("min-w-0 flex-1 truncate tabular-nums", label.isId ? "font-mono text-[13px] font-medium text-[var(--cl-text2)]" : "font-semibold text-[var(--cl-text)]")}>
          {label.text}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[12.5px] text-[var(--cl-text3)]">{relativeTime(call.call_started_at)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[13px] text-[var(--cl-text3)]">
        {status !== "completed" && <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--cl-st-fail)]" />}
        <span className="min-w-0 flex-1 truncate">
          {status} · <span className="font-mono">{formatDuration(callDurationSeconds(call) ?? 0)}</span>
        </span>
        {flagged && <Flag className="h-3.5 w-3.5 shrink-0 fill-current text-[var(--cl-red)]" aria-label="Flagged" />}
        <QuickDetails call={call} role={role} hasSummaryField={hasSummaryField} />
      </div>
    </div>
  )
}

function QuickDetails({ call, role, hasSummaryField }: Readonly<{ call: CallLog; role: string | null; hasSummaryField: boolean }>) {
  const summary = callSummary(call, hasSummaryField)
  const { dispositions } = splitTranscriptionMetrics(call)
  const tags: string[] = Array.isArray(call.transcription_metrics?.tags) ? call.transcription_metrics.tags : []
  const flags = normalizeFlags(call.transcription_metrics?.flag)
  const shown = dispositions.filter(([, v]) => formatValue(v)).slice(0, 4)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Quick details"
          onClick={(e) => e.stopPropagation()}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[var(--cl-text3)] opacity-0 transition-opacity hover:bg-[var(--cl-accent-soft)] hover:text-[var(--cl-accent-text)] group-hover:opacity-100"
        >
          <Info className="h-[13px] w-[13px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" align="start" className="w-[300px] p-3 text-[13px]">
        <p className="font-semibold">{callLabel(call, role).text}</p>
        <p className="text-xs opacity-70">
          {call.call_started_at ? formatToIndianDateTime(call.call_started_at) : ""} · {formatDuration(callDurationSeconds(call) ?? 0)}
        </p>
        {summary && <p className="mt-2 leading-relaxed opacity-90"><span className="text-violet-400">✦</span> {summary}</p>}
        {(shown.length > 0 || tags.length > 0 || flags.length > 0) && (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {shown.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="opacity-60">{k}</dt>
                <dd className="truncate text-right">{formatValue(v)}</dd>
              </React.Fragment>
            ))}
            {tags.length > 0 && (<><dt className="opacity-60">Tags</dt><dd className="truncate text-right">{tags.join(", ")}</dd></>)}
            {flags.length > 0 && (<><dt className="opacity-60">Flag</dt><dd className="truncate text-right text-rose-400">{flags[0].text}</dd></>)}
          </dl>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
