"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, Play, Wrench } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDuration, formatToIndianDateTime, isColumnVisibleForRole, isViewerRole } from "@/utils/callLogsUtils"
import type { TraceLog } from "@/hooks/useCallTranscript"
import type { CallLog } from "@/types/logs"
import type { PhoneNumber } from "@/lib/callDispatch"
import { cn } from "@/lib/utils"
import CallAgainDialog from "../../CallAgainDialog"
import { TagEditor } from "../../TagEditor"
import { FlagEditor } from "../../FlagEditor"
import { callDurationSeconds, callLabel, callSummary, formatClock, maskForRole, type TranscriptCue } from "./callData"

export interface ToolRef {
  key: string
  turnId: string
  tool: any
}

export const toolKey = (turnId: string, index: number) => `${turnId}:${index}`
export const toolName = (tool: any): string => tool?.tool_name || tool?.name || "unknown"
export const toolFailed = (tool: any): boolean => tool?.success === false || tool?.status === "error"

interface CallDetailProps {
  call: CallLog
  agent: any
  projectId: string
  role: string | null
  currentUserId: string | null
  currentUserEmail: string | null
  hasSummaryField: boolean
  availableTags: string[]
  onUpdated: () => void
  canOfferCallAgain: boolean
  outboundPhoneNumbers: PhoneNumber[]
  turns: TraceLog[]
  transcriptLoading: boolean
  bugReportTurnIds: Set<unknown>
  viewEnglish: boolean
  setViewEnglish: (v: boolean) => void
  isTranslating: boolean
  formatTranscript: (s: string | undefined | null) => string
  onOpenTool: (key: string) => void
  timeZero: number | null
  cues: TranscriptCue[]
  /** Key of the bubble being heard in the recording. */
  activeCue: string | null
  /** Jumps the recording to a time; absent when the call has no recording. */
  onSeek?: (seconds: number) => void
}

// How long after the reader scrolls the transcript before it follows the recording again.
const FOLLOW_PAUSE_MS = 4000

export function CallDetail(props: Readonly<CallDetailProps>) {
  const { role, turns, transcriptLoading, cues, activeCue } = props
  const cueStarts = useMemo(() => new Map(cues.map((c) => [c.key, c.start])), [cues])
  const scrollRef = useRef<HTMLDivElement>(null)
  const readerScrolledAt = useRef(0)

  // Keep the bubble being heard in view, unless the reader just scrolled away.
  useEffect(() => {
    const box = scrollRef.current
    if (!box || !activeCue || Date.now() - readerScrolledAt.current < FOLLOW_PAUSE_MS) return
    const el = box.querySelector<HTMLElement>(`[data-cue="${CSS.escape(activeCue)}"]`)
    if (!el) return
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top
    if (top < 40 || top + el.offsetHeight > box.clientHeight - 40) {
      box.scrollTo({ top: box.scrollTop + top - box.clientHeight / 3, behavior: "smooth" })
    }
  }, [activeCue])

  const markReaderScroll = () => {
    readerScrolledAt.current = Date.now()
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-[var(--cl-bg)]">
      <DetailHeader {...props} />
      <div ref={scrollRef} onWheel={markReaderScroll} onTouchMove={markReaderScroll} className="min-h-0 flex-1 overflow-y-auto">
        {transcriptLoading && turns.length === 0 ? (
          <TranscriptSkeleton />
        ) : turns.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-[var(--cl-text3)]">No transcript for this call.</p>
        ) : (
          <div className="flex flex-col gap-[18px] px-[22px] pb-7 pt-[18px]">
            {turns.map((turn) => (
              <Turn key={turn.id} turn={turn} {...props} cueStarts={cueStarts} role={role} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function DetailHeader({
  call, agent, projectId, role, currentUserId, currentUserEmail, hasSummaryField, availableTags, onUpdated,
  canOfferCallAgain, outboundPhoneNumbers, turns, viewEnglish, setViewEnglish, isTranslating, formatTranscript,
}: Readonly<CallDetailProps>) {
  const label = callLabel(call, role)
  const summary = callSummary(call, hasSummaryField)
  const tags: string[] = Array.isArray(call.transcription_metrics?.tags) ? call.transcription_metrics.tags : []
  const tagComments = call.transcription_metrics?.tagComments
  const status = call.call_ended_reason || "—"
  const transcriptText = turns
    .flatMap((t) => [
      t.user_transcript ? `Customer: ${formatTranscript(t.user_transcript)}` : null,
      t.agent_response ? `Agent: ${formatTranscript(t.agent_response)}` : null,
    ])
    .filter(Boolean)
    .join("\n")

  return (
    <div className="flex-none border-b border-[var(--cl-border)] bg-[var(--cl-panel)] px-5 pb-3 pt-3.5">
      <div className="flex min-h-[30px] items-center gap-1.5">
        <h2 className={cn("truncate text-[17px] font-semibold tracking-[-0.01em] tabular-nums", label.isId && "font-mono text-[15px] font-medium")}>
          {label.isId ? `Call ${label.text}` : label.text}
        </h2>
        {label.isId && <CopyButton text={call.call_id || call.id} label="Copy call ID" />}
        {summary && <SummarySpark summary={summary} />}
        <div className="ml-1">
          <FlagEditor
            variant="quiet"
            callId={call.id}
            initialFlag={call.transcription_metrics?.flag}
            currentUserId={currentUserId}
            currentUserEmail={currentUserEmail}
            canDeleteAnyFlag={role !== null && !isViewerRole(role)}
            onUpdated={onUpdated}
            key={`flag-${call.id}`}
          />
        </div>
        <div className="ml-auto flex flex-none items-center gap-1">
          {turns.length > 0 && (
            <>
              <div className="flex rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel2)] p-0.5" role="radiogroup" aria-label="Transcript language">
                {[["Original", false], ["English", true]].map(([text, english]) => (
                  <button
                    key={String(text)}
                    type="button"
                    role="radio"
                    aria-checked={viewEnglish === english}
                    onClick={() => setViewEnglish(english as boolean)}
                    className={cn(
                      "whitespace-nowrap rounded-md px-2 py-0.5 text-[12.5px] text-[var(--cl-text2)]",
                      viewEnglish === english && "bg-[var(--cl-raised)] text-[var(--cl-text)] shadow-[0_0_0_1px_var(--cl-border2)]"
                    )}
                  >
                    {text}
                    {english && isTranslating && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
                  </button>
                ))}
              </div>
              <CopyButton text={maskForRole(transcriptText, role)} label="Copy transcript" />
              <span aria-hidden className="mx-1 h-4 w-px bg-[var(--cl-border2)]" />
            </>
          )}
          {canOfferCallAgain && call.customer_number && (
            // Same dialog; its trigger is shown as an icon-only button here.
            <div title="Call again" className="[&>button]:h-[30px] [&>button]:w-[30px] [&>button]:gap-0 [&>button]:rounded-lg [&>button]:border-0 [&>button]:bg-transparent [&>button]:px-0 [&>button]:text-[0px] [&>button]:text-[var(--cl-text3)] [&>button:hover]:bg-[var(--cl-hover)] [&>button:hover]:text-[var(--cl-text)] [&>button_svg]:h-4 [&>button_svg]:w-4">
              <CallAgainDialog call={call} projectId={projectId} agent={agent} phoneNumbers={outboundPhoneNumbers} />
            </div>
          )}
          <a
            href={`/${projectId}/agents/${call.agent_id}/observability?session_id=${call.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the full trace in a new tab"
            aria-label="Open the full trace in a new tab"
            className="grid h-[30px] w-[30px] place-items-center rounded-lg text-[var(--cl-text3)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mt-0.5 flex items-center gap-2 text-[13px] text-[var(--cl-text3)]">
        <span className="flex-none whitespace-nowrap">
          {status !== "completed" && <span aria-hidden className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-[var(--cl-st-fail)] align-[1px]" />}
          {status} · {call.call_started_at ? formatToIndianDateTime(call.call_started_at) : "—"} · {formatDuration(callDurationSeconds(call) ?? 0)}
        </span>
        {!label.isId && call.call_id && (
          <span className="inline-flex flex-none items-center gap-0.5 font-mono text-[12.5px]" title={call.call_id}>
            …{call.call_id.slice(-8)}
            <CopyButton text={call.call_id} label="Copy call ID" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 items-center overflow-hidden">
          {isColumnVisibleForRole("tags", role) && (
            <TagEditor
              key={`tags-${call.id}`}
              variant="quiet"
              callId={call.id}
              initialTags={tags}
              initialTagComments={tagComments && typeof tagComments === "object" && !Array.isArray(tagComments) ? tagComments : {}}
              availableTags={availableTags}
              canComment={role !== null && !isViewerRole(role)}
              onUpdated={onUpdated}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SummarySpark({ summary }: Readonly<{ summary: string }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="grid h-5 w-5 shrink-0 cursor-help place-items-center rounded-full text-violet-500 hover:bg-violet-500/10 dark:text-violet-400">
          <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] fill-current drop-shadow-[0_0_4px_rgba(167,139,250,.7)]" aria-label="Summary">
            <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" />
            <path d="M19 2l.7 2.1L22 5l-2.3.9L19 8l-.7-2.1L16 5l2.3-.9z" />
          </svg>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-[360px] p-3 text-[13px] leading-relaxed">
        <p className="mb-1 font-semibold text-violet-400">✦ Summary</p>
        {summary}
      </TooltipContent>
    </Tooltip>
  )
}

export function CopyButton({ text, label }: Readonly<{ text: string; label: string }>) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--cl-text3)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function Turn({
  turn, cueStarts, activeCue, onSeek, role, bugReportTurnIds, formatTranscript, onOpenTool,
}: Readonly<CallDetailProps & { turn: TraceLog; cueStarts: Map<string, number> }>) {
  const userKey = `${turn.id}:user`
  const agentKey = `${turn.id}:agent`
  const tools: any[] = Array.isArray(turn.tool_calls) ? turn.tool_calls : []
  const fallbacks: any[] = Array.isArray(turn.enhanced_data?.fallback_events) ? turn.enhanced_data!.fallback_events! : []
  const hasBug = bugReportTurnIds.has(String(turn.turn_id))
  return (
    <>
      {turn.user_transcript && (
        <Bubble
          cueKey={userKey}
          text={maskForRole(formatTranscript(turn.user_transcript), role)}
          start={cueStarts.get(userKey)}
          active={activeCue === userKey}
          onSeek={onSeek}
        />
      )}
      {(turn.agent_response || tools.length > 0) && (
        <div className="flex max-w-[84%] gap-3">
          <Avatar who="agent" />
          <div className="min-w-0">
            {turn.agent_response && (
              <div
                data-cue={agentKey}
                className={cn(
                  "rounded-[14px] rounded-tl-[4px] border px-[15px] py-[11px] text-[15.5px] leading-[1.6] transition-[border-color,box-shadow] duration-300",
                  activeCue === agentKey
                    ? "border-[var(--cl-accent-line)] bg-[var(--cl-raised)] shadow-[0_0_0_3px_var(--cl-accent-soft)]"
                    : "border-[var(--cl-border2)] bg-[var(--cl-raised)]"
                )}
              >
                {formatTranscript(turn.agent_response)}
              </div>
            )}
            <div className="mt-[5px] flex flex-wrap items-center gap-2 font-mono text-[12.5px] text-[var(--cl-text3)]">
              {turn.agent_response && <CueTime start={cueStarts.get(agentKey)} active={activeCue === agentKey} onSeek={onSeek} />}
              {typeof turn.llm_metrics?.ttft === "number" && <span title="Time to first token">{Math.round(turn.llm_metrics.ttft * 1000)}ms</span>}
              {hasBug && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--cl-red-line)] bg-[var(--cl-red-soft)] px-2 font-sans text-[11.5px] text-[var(--cl-red-text)]">
                  <AlertTriangle className="h-3 w-3" /> Bug report
                </span>
              )}
            </div>
            {tools.length > 0 && (
              <div className="mt-[7px] flex flex-wrap gap-1.5">
                {tools.map((tool, i) => (
                  <ToolPill key={toolKey(turn.turn_id, i)} tool={tool} role={role} onOpen={() => onOpenTool(toolKey(turn.turn_id, i))} />
                ))}
              </div>
            )}
            {fallbacks.map((fb, i) => (
              <p key={`${fb.timestamp}-${i}`} className="mt-1.5 flex items-center gap-1 text-[12px] text-[var(--cl-red-text)]">
                <AlertTriangle className="h-3 w-3" />
                {fb.event_type === "provider_recovered"
                  ? `${fb.provider_type || "Provider"} recovered`
                  : `${fb.provider_type || "Provider"} fallback: ${fb.provider_label || fb.provider_name} → ${fb.fallback_label || fb.fallback_provider || "none"}`}
              </p>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// Placeholder bubbles in the transcript's own shape, alternating agent/customer.
const SKELETON_TURNS: Array<{ side: "agent" | "user"; lines: number[] }> = [
  { side: "agent", lines: [92, 64] },
  { side: "user", lines: [48] },
  { side: "agent", lines: [100, 86, 40] },
  { side: "user", lines: [70, 36] },
  { side: "agent", lines: [80, 52] },
  { side: "user", lines: [42] },
]

function TranscriptSkeleton() {
  return (
    <div role="status" aria-label="Loading transcript" className="flex animate-pulse flex-col gap-[18px] px-[22px] pb-7 pt-[18px]">
      {SKELETON_TURNS.map((turn, i) => {
        const user = turn.side === "user"
        return (
          <div key={i} className={cn("flex w-[62%] gap-3", user && "flex-row-reverse self-end w-[46%]")}>
            <span className="mt-0.5 h-[30px] w-[30px] shrink-0 rounded-full bg-[var(--cl-hover)]" />
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "flex flex-col gap-2 rounded-[14px] border border-[var(--cl-border)] px-[15px] py-[13px]",
                  user ? "rounded-tr-[4px] bg-[var(--cl-panel2)]" : "rounded-tl-[4px] bg-[var(--cl-panel)]"
                )}
              >
                {turn.lines.map((w, j) => (
                  <span key={j} className="h-[11px] rounded-full bg-[var(--cl-hover)]" style={{ width: `${w}%` }} />
                ))}
              </div>
              <span className={cn("mt-[7px] block h-[9px] w-9 rounded-full bg-[var(--cl-hover)]", user && "ml-auto")} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Avatar({ who }: Readonly<{ who: "agent" | "user" }>) {
  return (
    <span
      className={cn(
        "mt-0.5 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[12px] font-semibold",
        who === "agent" ? "bg-[var(--cl-accent-soft)] text-[var(--cl-accent-text)]" : "bg-[var(--cl-hover)] text-[var(--cl-text2)]"
      )}
    >
      {who === "agent" ? "AI" : "C"}
    </span>
  )
}

function Bubble({
  cueKey, text, start, active, onSeek,
}: Readonly<{ cueKey: string; text: string; start: number | undefined; active: boolean; onSeek?: (seconds: number) => void }>) {
  return (
    <div className="flex max-w-[84%] flex-row-reverse gap-3 self-end">
      <Avatar who="user" />
      <div className="min-w-0">
        <div
          data-cue={cueKey}
          className={cn(
            "rounded-[14px] rounded-tr-[4px] border bg-[#eff6ff] px-[15px] py-[11px] text-[15.5px] leading-[1.6] transition-[border-color,box-shadow] duration-300 dark:bg-[#1c2b4a]",
            active
              ? "border-[#60a5fa] shadow-[0_0_0_3px_rgba(59,130,246,.18)] dark:border-[#3b82f6]"
              : "border-[#bfdbfe] dark:border-[#24365c]"
          )}
        >
          {text}
        </div>
        <div className="mt-[5px] flex justify-end font-mono text-[12.5px] text-[var(--cl-text3)]">
          <CueTime start={start} active={active} onSeek={onSeek} />
        </div>
      </div>
    </div>
  )
}

/** A bubble's time in the recording; clicking it plays from there. */
function CueTime({ start, active, onSeek }: Readonly<{ start: number | undefined; active: boolean; onSeek?: (seconds: number) => void }>) {
  if (start === undefined) return null
  const label = formatClock(start)
  if (!onSeek) return <span>{label}</span>
  return (
    <button
      type="button"
      onClick={() => onSeek(start)}
      title={`Play from ${label}`}
      className={cn(
        "group/cue -mx-1 inline-flex items-center gap-1 rounded px-1 hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]",
        active && "text-[var(--cl-accent-text)]"
      )}
    >
      <Play className={cn("h-2.5 w-2.5 fill-current", active ? "inline" : "hidden group-hover/cue:inline")} />
      {label}
    </button>
  )
}

function ToolPill({ tool, role, onOpen }: Readonly<{ tool: any; role: string | null; onOpen: () => void }>) {
  const failed = toolFailed(tool)
  const args = tool.arguments == null ? null : maskForRole(typeof tool.arguments === "string" ? tool.arguments : JSON.stringify(tool.arguments, null, 2), role)
  const result = tool.result == null ? null : maskForRole(String(tool.result), role)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "inline-flex h-[25px] items-center gap-1.5 rounded-full border px-2.5 text-[12.5px]",
            failed
              ? "border-[var(--cl-red-line)] bg-[var(--cl-red-soft)] text-[var(--cl-red-text)]"
              : "border-[var(--cl-border2)] bg-[var(--cl-hover)] text-[var(--cl-text2)] hover:bg-[var(--cl-border)]"
          )}
        >
          <Wrench className="h-3 w-3" />
          <span className={cn("font-mono", !failed && "text-[var(--cl-text)]")}>{toolName(tool)}</span>
          {failed ? "✕" : "✓"}
          {typeof tool.duration_ms === "number" && <span className="font-mono text-[var(--cl-text3)]">{Math.round(tool.duration_ms)}ms</span>}
        </button>
      </TooltipTrigger>
      {/* Radix keeps tooltip content open while the pointer is inside it, so the JSON can be scrolled and copied. */}
      <TooltipContent side="bottom" align="start" className="w-[360px] p-3 text-[12.5px]">
        <p className={cn("mb-2 flex items-center gap-1.5 font-mono font-semibold", failed && "text-rose-400")}>
          <Wrench className="h-3 w-3" /> {toolName(tool)}
        </p>
        {args && (
          <>
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider opacity-60">Arguments</p>
            <pre className="mb-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/20 p-2 font-mono text-[11.5px]">{args}</pre>
          </>
        )}
        {result && (
          <>
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider opacity-60">{failed ? "Error" : "Response"}</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/20 p-2 font-mono text-[11.5px]">{result}</pre>
          </>
        )}
        <button type="button" onClick={onOpen} className="mt-2 text-[12px] text-blue-400 hover:underline">
          Open in Tools tab →
        </button>
      </TooltipContent>
    </Tooltip>
  )
}
