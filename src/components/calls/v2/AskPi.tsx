"use client"

// Ask Pi's chat on the Call Logs page, shown inside the floating Pi box
// (FloatingPi). It talks to the existing Pi backend with this page's context, so
// "today's calls", "these calls" and "this call" mean what is on screen. Pi can
// read transcripts and suggest filters; filters only change on an Apply click.
// Not rendered for viewers.

import React, { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import { ArrowUp, Check, Filter, RotateCcw } from "lucide-react"
import type { FilterOperation } from "@/components/CallFilter"
import type { Message } from "@/lib/piStream"
import { usePiConversation } from "@/hooks/usePiConversation"
import { PiDockBody, usePiDock, usePiSurface } from "@/contexts/PiDockContext"
import { ThinkingIndicator } from "@/components/pi/PiChatView"
import { cn } from "@/lib/utils"

export interface FilterProposal {
  mode: "add" | "replace"
  filters: Array<{ column: string; operation: string; value: string; jsonField?: string }>
  explanation: string | null
}

interface AskPiProps {
  projectId: string
  agentId: string
  openCallId: string | null
  filters: FilterOperation[]
  dateRange?: { from: string; to: string }
  /** e.g. "25 calls · 7D" — shown in the header. */
  contextLabel: string
  onApplyFilters: (proposal: FilterProposal) => void
  onOpenCall: (callId: string) => void
}

const SUGGESTIONS = [
  "Summarise what happened in today's connected calls",
  "Why did today's failed calls fail?",
  "How many voicemail calls this week?",
  "Show me flagged calls",
]

const CALL_SUGGESTIONS = [
  "Summarise this call",
  "What did the customer want?",
  "Why did the call end this way?",
  "Did the agent handle it correctly?",
]

const TOOL_STEPS: Record<string, string> = {
  call_breakdown: "Counting calls",
  summarize_call_transcripts: "Reading transcripts",
  propose_call_filters: "Preparing filters",
  query_analytics: "Running numbers",
  list_analytics_fields: "Checking fields",
  search_field_definitions: "Checking fields",
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function PiMark({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 4v16M4 7c0-1.7 1.3-3 3-3h13M18 20c-1.7 0-3-1.3-3-3V4" />
    </svg>
  )
}

export function AskPi(props: Readonly<AskPiProps>) {
  usePiSurface({ label: props.contextLabel })
  return <PiDockBody><PiChat {...props} /></PiDockBody>
}

function PiChat({
  projectId, agentId, openCallId, filters, dateRange, onApplyFilters, onOpenCall,
}: Readonly<AskPiProps>) {
  const max = usePiDock()?.max ?? false
  const [input, setInput] = useState("")
  const [applied, setApplied] = useState<Record<string, "applied" | "dismissed">>({})
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pi = usePiConversation({
    projectId,
    getPageContext: () => ({
      surface: "call_logs",
      agentId,
      openCallId,
      filters: filters.map((f) => (f.type === "filter" ? { column: f.column, operation: f.operation, value: f.value, jsonField: f.jsonField } : { column: f.column, operation: "unique_by", jsonField: f.jsonField })),
      dateRange: filters.some((f) => f.type === "filter" && f.column === "call_started_at") ? null : dateRange ?? null,
    }),
  })
  const { messages, busy } = pi

  useLayoutEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const ask = useCallback(async (text: string) => {
    if (!text.trim() || busy) return
    setInput("")
    await pi.ask(text)
    inputRef.current?.focus()
  }, [busy, pi])

  const reset = () => {
    pi.reset()
    setApplied({})
  }

  return (
    <>
      {messages.length > 0 && (
        <div className="flex flex-none justify-end px-2.5 pt-1.5">
          <HeaderButton label="New chat" onClick={reset}><RotateCcw className="h-3.5 w-3.5" /></HeaderButton>
        </div>
      )}

      <div ref={bodyRef} className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", max ? "gap-[22px] px-6 py-5" : "gap-4 px-4 py-3.5")}>
        {messages.length === 0 ? (
          <div>
            <h2 className={cn("font-semibold tracking-[-0.02em]", max ? "mb-1.5 mt-5 text-[24px]" : "mb-1 mt-1.5 text-[19px]")}>Hi, I&apos;m π.</h2>
            <p className={cn("leading-[1.6] text-[var(--cl-text2)]", max ? "text-[15px]" : "text-[14px]")}>
              {openCallId
                ? "Ask me about the call you have open — I've read its transcript. You can still ask about other calls too."
                : "Ask me about this agent's calls: what's happening in them, why they fail, how many there are, or which ones to look at. I can read transcripts and set filters for you."}
            </p>
            <div className={cn("flex flex-wrap", max ? "mt-[18px] gap-2" : "mt-3 gap-1.5")}>
              {(openCallId ? CALL_SUGGESTIONS : SUGGESTIONS).map((q) => (
                <button key={q} type="button" onClick={() => { ask(q).catch(() => {}) }} className="rounded-full border border-[var(--cl-border2)] bg-[var(--cl-panel)] px-2.5 py-[5px] text-left text-[13px] text-[var(--cl-text2)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className={cn("max-w-[80%] self-end rounded-[16px_16px_4px_16px] border border-[var(--cl-border)] bg-[var(--cl-hover)] px-[13px] py-2", max ? "text-[15px]" : "text-[14px]")}>{m.content}</div>
            ) : (
              <AssistantMessage key={m.id} message={m} large={max} applied={applied} onOpenCall={onOpenCall}
                onApply={(id, proposal) => { onApplyFilters(proposal); setApplied((a) => ({ ...a, [id]: "applied" })) }}
                onDismiss={(id) => setApplied((a) => ({ ...a, [id]: "dismissed" }))}
              />
            )
          )
        )}
      </div>

      <div className="flex-none border-t border-[var(--cl-border)] px-2.5 pb-2.5 pt-2">
        {/* The whole box is the text field's hit area, not just its first line: a
            <label> around the textarea focuses it on a click anywhere outside the button. */}
        <label
          className="block cursor-text rounded-xl border border-[var(--cl-border2)] bg-[var(--cl-panel)] px-2 py-1.5 focus-within:border-[var(--cl-text3)]"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            placeholder="Ask Pi…"
            aria-label="Ask Pi"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                ask(input).catch(() => {})
              }
            }}
            className={cn("max-h-32 w-full resize-none border-0 bg-transparent p-1 leading-[1.5] text-[var(--cl-text)] outline-none placeholder:text-[var(--cl-text3)]", max ? "text-[15px]" : "text-[14px]")}
          />
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Send"
              disabled={busy || !input.trim()}
              onClick={() => { ask(input).catch(() => {}) }}
              className="grid h-7 w-7 place-items-center rounded-full bg-[var(--cl-text)] text-[var(--cl-bg)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </label>
        <p className="mt-1.5 text-center text-[11.5px] text-[var(--cl-text3)]">Pi reads this agent&apos;s calls and transcripts. Filters change only when you click Apply.</p>
      </div>
    </>
  )
}

function HeaderButton({ label, onClick, children }: Readonly<{ label: string; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid h-[26px] w-[26px] place-items-center rounded-md text-[var(--cl-text3)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]">
      {children}
    </button>
  )
}

const AssistantMessage = memo(function AssistantMessage({
  message, large, applied, onApply, onDismiss, onOpenCall,
}: Readonly<{
  message: Message
  large: boolean
  applied: Record<string, "applied" | "dismissed">
  onApply: (toolCallId: string, proposal: FilterProposal) => void
  onDismiss: (toolCallId: string) => void
  onOpenCall: (id: string) => void
}>) {
  const calls = message.toolCalls ?? []
  const running = calls.find((tc) => tc.pending && TOOL_STEPS[tc.name])
  // finished steps, each named once ("Reading transcripts" twice is still one line)
  const done = calls.filter((tc) => !tc.pending && TOOL_STEPS[tc.name]).filter((tc, i, all) => all.findIndex((o) => TOOL_STEPS[o.name] === TOOL_STEPS[tc.name]) === i)
  const proposals = calls.filter((tc) => tc.success && tc.result?.__filterProposal)
  const working = !message.isFinal && !message.content
  return (
    <div className={cn("leading-[1.65] text-[var(--cl-text)]", large ? "text-[15px]" : "text-[14px]")}>
      {done.length > 0 && (
        <ul className="mb-1 space-y-1">
          {done.map((tc) => (
            <li key={tc.id} className="flex items-center gap-2 text-[13px] text-[var(--cl-text3)]">
              <Check className="h-3.5 w-3.5 text-emerald-500" />{TOOL_STEPS[tc.name]}
            </li>
          ))}
        </ul>
      )}
      {working && <ThinkingIndicator label={running ? `${TOOL_STEPS[running.name]}…` : undefined} />}
      {message.content && <PiMarkdown text={message.content} onOpenCall={onOpenCall} />}
      {proposals.map((tc) => (
        <FilterCard key={tc.id} proposal={tc.result as FilterProposal} state={applied[tc.id]} onApply={() => onApply(tc.id, tc.result)} onDismiss={() => onDismiss(tc.id)} />
      ))}
    </div>
  )
})

// Renderers for Pi's markdown, kept outside any component so they aren't
// redefined on every render. Only `code` needs the page: a cited call id opens it.
const PI_MARKDOWN_STATIC: Components = {
  // a model-written image or link is a free request to any URL; neither is needed here
  img: () => null,
  a: ({ children }) => <span>{children}</span>,
  p: ({ children }) => <p className="m-0 [&+*]:mt-2.5">{children}</p>,
  ul: ({ children }) => <ul className="mb-0 mt-2 list-disc pl-5 [&+*]:mt-2.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-0 mt-2 list-decimal pl-5 [&+*]:mt-2.5">{children}</ol>,
  li: ({ children }) => <li className="my-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
}

function codeText(children: unknown): string {
  if (typeof children === "string") return children
  if (Array.isArray(children)) return children.filter((c): c is string => typeof c === "string").join("")
  return ""
}

function piMarkdownComponents(onOpenCall: (id: string) => void): Components {
  return {
    ...PI_MARKDOWN_STATIC,
    code: ({ children }) => {
      const text = codeText(children)
      const value = text.trim()
      // call ids Pi cites open that call
      if (UUID.test(value)) {
        return (
          <button type="button" onClick={() => onOpenCall(value)} title="Open this call" className="rounded-[5px] bg-[var(--cl-accent-soft)] px-[5px] font-mono text-[13px] text-[var(--cl-accent-text)] hover:underline">
            …{value.slice(-8)}
          </button>
        )
      }
      return <code className="rounded bg-[var(--cl-hover)] px-1 font-mono text-[13px]">{children}</code>
    },
  }
}

function PiMarkdown({ text, onOpenCall }: Readonly<{ text: string; onOpenCall: (id: string) => void }>) {
  const components = useMemo(() => piMarkdownComponents(onOpenCall), [onOpenCall])
  return <ReactMarkdown components={components}>{text}</ReactMarkdown>
}

const OP_LABELS: Record<string, string> = {
  equals: "is", not_equals: "is not", contains: "contains", starts_with: "starts with", greater_than: ">", less_than: "<",
  exists: "exists", flagged_by: "flagged by", json_equals: "is", json_not_equals: "is not", json_contains: "contains",
  json_exists: "exists", json_greater_than: ">", json_less_than: "<",
}

function filterFieldLabel(f: FilterProposal["filters"][number]): string {
  if (!f.jsonField) return f.column.replaceAll("_", " ")
  const root = f.column === "metadata" ? "metadata" : "disposition"
  return `${root}.${f.jsonField}`
}

function FilterCardActions({ state, onApply, onDismiss }: Readonly<{ state?: "applied" | "dismissed"; onApply: () => void; onDismiss: () => void }>) {
  if (state === "applied") {
    return <span className="inline-flex items-center gap-1 text-[13px] text-success"><Check className="h-3.5 w-3.5" /> Applied</span>
  }
  if (state === "dismissed") return <span className="text-[13px] text-[var(--cl-text3)]">Not applied</span>
  return (
    <>
      <button type="button" onClick={onApply} className="h-7 rounded-lg bg-[var(--cl-violet)] px-3 text-[13px] font-medium text-white hover:opacity-90">Apply</button>
      <button type="button" onClick={onDismiss} className="h-7 rounded-lg px-2.5 text-[13px] text-[var(--cl-text2)] hover:bg-[var(--cl-hover)]">Dismiss</button>
    </>
  )
}

function FilterCard({ proposal, state, onApply, onDismiss }: Readonly<{ proposal: FilterProposal; state?: "applied" | "dismissed"; onApply: () => void; onDismiss: () => void }>) {
  return (
    <div className="mt-2.5 rounded-xl border border-[var(--cl-violet-line)] bg-[var(--cl-violet-soft)] p-3">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--cl-violet-text)]">
        <Filter className="h-3.5 w-3.5" /> {proposal.explanation || (proposal.mode === "replace" ? "Replace the filters with" : "Add filters")}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {proposal.filters.map((f) => (
          <span key={`${f.column}|${f.jsonField ?? ""}|${f.operation}|${f.value}`} className="rounded-full border border-[var(--cl-border2)] bg-[var(--cl-panel)] px-2 py-0.5 text-[12.5px] text-[var(--cl-text2)]">
            {filterFieldLabel(f)}{" "}
            {OP_LABELS[f.operation] ?? f.operation}
            {f.operation === "exists" || f.operation === "json_exists" ? "" : <b className="font-medium text-[var(--cl-text)]"> {f.value}</b>}
          </span>
        ))}
      </div>
      {proposal.mode === "replace" && !state && <p className="mt-1.5 text-[12px] text-[var(--cl-text3)]">Replaces the filters you have now.</p>}
      <div className="mt-2.5 flex items-center gap-2">
        <FilterCardActions state={state} onApply={onApply} onDismiss={onDismiss} />
      </div>
    </div>
  )
}
