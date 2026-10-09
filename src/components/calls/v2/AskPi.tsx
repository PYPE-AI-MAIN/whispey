"use client"

// Ask Pi on the Call Logs page, as in the mockup: a violet button floating
// bottom-right (drag it up or down), opening a small chat box above it that can
// be expanded. It talks to the existing Pi backend with this page's context, so
// "today's calls", "these calls" and "this call" mean what is on screen. Pi can
// read transcripts and suggest filters; filters only change on an Apply click.
// Not rendered for viewers.

import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { ArrowUp, Check, Filter, Maximize2, Minimize2, RotateCcw, X } from "lucide-react"
import type { FilterOperation } from "@/components/CallFilter"
import { applyEvent, classifyEvent, consumeSse, failAssistant, parseSseLine, type Message } from "@/lib/piStream"
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

const TOOL_STEPS: Record<string, string> = {
  call_breakdown: "Counting calls",
  summarize_call_transcripts: "Reading transcripts",
  propose_call_filters: "Preparing filters",
  query_analytics: "Running numbers",
  list_analytics_fields: "Checking fields",
  search_field_definitions: "Checking fields",
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FAB_OFFSET_KEY = "whispey:askPiFabOffset"
const maxFabLift = () => Math.max(0, Math.min(320, globalThis.innerHeight - 260))

function readOffset(): number {
  try {
    const v = Number(globalThis.localStorage?.getItem(FAB_OFFSET_KEY))
    return Number.isFinite(v) ? v : 0
  } catch {
    return 0
  }
}

function PiMark({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 4v16M4 7c0-1.7 1.3-3 3-3h13M18 20c-1.7 0-3-1.3-3-3V4" />
    </svg>
  )
}

export function AskPi(props: Readonly<AskPiProps>) {
  const { contextLabel } = props
  const [open, setOpen] = useState(false)
  const [max, setMax] = useState(false)
  // How far the button has been dragged up from its resting place (negative = up).
  const [lift, setLift] = useState(0)
  useEffect(() => setLift(Math.max(-maxFabLift(), Math.min(0, readOffset()))), [])
  const drag = useRef<{ y: number; start: number; moved: boolean } | null>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  const endDrag = useCallback(() => {
    const d = drag.current
    if (!d) return
    drag.current = null
    fabRef.current?.removeAttribute("data-dragging")
    if (d.moved) {
      try { globalThis.localStorage?.setItem(FAB_OFFSET_KEY, String(lift)) } catch { /* per-viewer nicety only */ }
    }
  }, [lift])

  useEffect(() => {
    globalThis.addEventListener("pointerup", endDrag)
    globalThis.addEventListener("blur", endDrag)
    return () => {
      globalThis.removeEventListener("pointerup", endDrag)
      globalThis.removeEventListener("blur", endDrag)
    }
  }, [endDrag])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        setOpen(false)
      }
    }
    // capture: Esc here closes Pi instead of also closing the open call
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open])

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        title="Ask Pi about the calls in this view · drag up or down to move"
        style={{ transform: `translateY(${lift}px)` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          drag.current = { y: e.clientY, start: lift, moved: false }
          try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          if (e.buttons === 0) return endDrag()
          const dy = e.clientY - d.y
          if (!d.moved && Math.abs(dy) > 4) {
            d.moved = true
            e.currentTarget.setAttribute("data-dragging", "")
          }
          if (d.moved) setLift(Math.max(-maxFabLift(), Math.min(0, d.start + dy)))
        }}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onClick={() => {
          // a drag ends with a click; it shouldn't also toggle the box
          if (fabRef.current?.dataset.justDragged) return
          setOpen((o) => !o)
        }}
        onPointerUp={(e) => {
          if (drag.current?.moved) {
            e.currentTarget.dataset.justDragged = "1"
            setTimeout(() => { if (fabRef.current) delete fabRef.current.dataset.justDragged }, 0)
          }
        }}
        className={cn(
          "fixed bottom-24 right-5 z-[85] inline-flex h-10 cursor-pointer touch-none select-none items-center gap-2 rounded-full bg-[var(--cl-violet)] pl-1.5 pr-4 text-[14px] font-semibold text-white",
          "shadow-[0_8px_24px_rgba(124,58,237,.35),0_2px_6px_rgba(0,0,0,.25)] transition-shadow hover:shadow-[0_10px_28px_rgba(124,58,237,.45),0_2px_6px_rgba(0,0,0,.25)] data-[dragging]:cursor-grabbing",
          open && "shadow-[0_0_0_3px_var(--cl-violet-soft),0_8px_24px_rgba(124,58,237,.35)]"
        )}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20"><PiMark className="h-3.5 w-3.5" /></span>
        Ask Pi
      </button>

      {/* Kept mounted while closed, so the conversation survives closing the box. */}
      {/* A region, not a dialog: the page stays usable (and its shortcuts live) while it's open. */}
      <section
        aria-label="Ask Pi"
        hidden={!open}
        style={{ bottom: `calc(${148 - lift}px)` }}
        className={cn(
          "fixed right-5 z-[90] flex flex-col overflow-hidden rounded-2xl border border-[var(--cl-border2)] bg-[var(--cl-panel)] text-[var(--cl-text)] shadow-[var(--cl-shadow)] transition-[width,height] duration-200",
          max ? "h-[min(680px,calc(100vh-120px))] w-[min(620px,calc(100vw-32px))]" : "h-[min(480px,calc(100vh-180px))] w-[380px]"
        )}
      >
        <PiChat {...props} max={max} onToggleMax={() => setMax((m) => !m)} onClose={() => setOpen(false)} contextLabel={contextLabel} />
      </section>
    </>
  )
}

function PiChat({
  projectId, agentId, openCallId, filters, dateRange, contextLabel, onApplyFilters, onOpenCall, max, onToggleMax, onClose,
}: Readonly<AskPiProps & { max: boolean; onToggleMax: () => void; onClose: () => void }>) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState<Record<string, "applied" | "dismissed">>({})
  const sessionRef = useRef<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useLayoutEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  const ask = useCallback(async (text: string) => {
    const message = text.trim()
    if (!message || busy) return
    setInput("")
    setBusy(true)
    const assistantId = `a-${Date.now()}`
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: message, isFinal: true }, { id: assistantId, role: "assistant", content: "", isFinal: false }])
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch("/api/pi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          projectId,
          sessionId: sessionRef.current,
          pageContext: {
            surface: "call_logs",
            agentId,
            openCallId,
            filters: filters.map((f) => (f.type === "filter" ? { column: f.column, operation: f.operation, value: f.value, jsonField: f.jsonField } : { column: f.column, operation: "unique_by", jsonField: f.jsonField })),
            dateRange: filters.some((f) => f.type === "filter" && f.column === "call_started_at") ? null : dateRange ?? null,
          },
        }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null)
        setMessages((m) => failAssistant(m, assistantId, err?.error ?? "Pi couldn't answer. Please try again."))
        return
      }
      await consumeSse(res.body, (line) => {
        const parsed = parseSseLine(line)
        if (!parsed) return
        const event = "done" in parsed ? ({ kind: "done" } as const) : classifyEvent(parsed.event, !!sessionRef.current)
        if (event.kind === "session") {
          sessionRef.current = event.sessionId
          return
        }
        setMessages((m) => applyEvent(m, assistantId, event))
      })
      setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, isFinal: true } : x)))
    } catch (err: any) {
      if (err?.name !== "AbortError") setMessages((m) => failAssistant(m, assistantId, "Pi couldn't answer. Please try again."))
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }, [busy, projectId, agentId, openCallId, filters, dateRange])

  const reset = () => {
    abortRef.current?.abort()
    sessionRef.current = null
    setMessages([])
    setApplied({})
    setBusy(false)
  }

  return (
    <>
      <div className="flex flex-none items-center gap-2 border-b border-[var(--cl-border)] py-[9px] pl-3 pr-2.5">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[var(--cl-violet)] text-white"><PiMark className="h-3 w-3" /></span>
        <b className="text-[14px]">Ask Pi</b>
        <span className="min-w-0 truncate rounded-full border border-[var(--cl-border2)] px-[9px] py-0.5 text-[12.5px] text-[var(--cl-text3)]" title={contextLabel}>{contextLabel}</span>
        <span className="flex-1" />
        {messages.length > 0 && <HeaderButton label="New chat" onClick={reset}><RotateCcw className="h-3.5 w-3.5" /></HeaderButton>}
        <HeaderButton label={max ? "Shrink" : "Expand"} onClick={onToggleMax}>{max ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</HeaderButton>
        <HeaderButton label="Close (Esc)" onClick={onClose}><X className="h-4 w-4" /></HeaderButton>
      </div>

      <div ref={bodyRef} className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", max ? "gap-[22px] px-6 py-5" : "gap-4 px-4 py-3.5")}>
        {messages.length === 0 ? (
          <div>
            <h2 className={cn("font-semibold tracking-[-0.02em]", max ? "mb-1.5 mt-5 text-[24px]" : "mb-1 mt-1.5 text-[19px]")}>Hi, I&apos;m π.</h2>
            <p className={cn("leading-[1.6] text-[var(--cl-text2)]", max ? "text-[15px]" : "text-[14px]")}>
              Ask me about this agent&apos;s calls: what&apos;s happening in them, why they fail, how many there are, or which ones to look at. I can read transcripts and set filters for you.
            </p>
            <div className={cn("flex flex-wrap", max ? "mt-[18px] gap-2" : "mt-3 gap-1.5")}>
              {SUGGESTIONS.map((q) => (
                <button key={q} type="button" onClick={() => void ask(q)} className="rounded-full border border-[var(--cl-border2)] bg-[var(--cl-panel)] px-2.5 py-[5px] text-left text-[13px] text-[var(--cl-text2)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]">
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
        <div className="rounded-xl border border-[var(--cl-border2)] bg-[var(--cl-panel)] px-2 py-1.5 focus-within:border-[var(--cl-text3)]">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            placeholder="Ask Pi…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void ask(input)
              }
            }}
            className={cn("max-h-32 w-full resize-none border-0 bg-transparent p-1 leading-[1.5] text-[var(--cl-text)] outline-none placeholder:text-[var(--cl-text3)]", max ? "text-[15px]" : "text-[14px]")}
          />
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Send"
              disabled={busy || !input.trim()}
              onClick={() => void ask(input)}
              className="grid h-7 w-7 place-items-center rounded-full bg-[var(--cl-text)] text-[var(--cl-bg)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
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
  const running = calls.find((tc) => tc.pending)
  const lastStep = running ?? [...calls].reverse().find((tc) => TOOL_STEPS[tc.name])
  const proposals = calls.filter((tc) => tc.success && tc.result?.__filterProposal)
  const thinking = !message.isFinal && !message.content && !running
  return (
    <div className={cn("leading-[1.65] text-[var(--cl-text)]", large ? "text-[15px]" : "text-[14px]")}>
      {lastStep && TOOL_STEPS[lastStep.name] && (
        <div className="mb-2 inline-flex items-center gap-[7px] text-[13px] text-[var(--cl-text3)]">
          <span className={cn("h-[11px] w-[11px] rounded-full border-[1.5px]", lastStep.pending ? "animate-spin border-[var(--cl-border2)] border-t-[var(--cl-violet)]" : "border-emerald-500 bg-emerald-500")} />
          {TOOL_STEPS[lastStep.name]}{lastStep.pending ? "…" : ""}
        </div>
      )}
      {thinking && <div className="mb-2 inline-flex items-center gap-[7px] text-[13px] text-[var(--cl-text3)]"><span className="h-[11px] w-[11px] animate-spin rounded-full border-[1.5px] border-[var(--cl-border2)] border-t-[var(--cl-violet)]" />Thinking…</div>}
      {message.content && <PiMarkdown text={message.content} onOpenCall={onOpenCall} />}
      {proposals.map((tc) => (
        <FilterCard key={tc.id} proposal={tc.result as FilterProposal} state={applied[tc.id]} onApply={() => onApply(tc.id, tc.result)} onDismiss={() => onDismiss(tc.id)} />
      ))}
    </div>
  )
})

function PiMarkdown({ text, onOpenCall }: Readonly<{ text: string; onOpenCall: (id: string) => void }>) {
  return (
    <ReactMarkdown
      components={{
        // a model-written image or link is a free request to any URL; neither is needed here
        img: () => null,
        a: ({ children }) => <span>{children}</span>,
        p: ({ children }) => <p className="m-0 [&+*]:mt-2.5">{children}</p>,
        ul: ({ children }) => <ul className="mb-0 mt-2 list-disc pl-5 [&+*]:mt-2.5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-0 mt-2 list-decimal pl-5 [&+*]:mt-2.5">{children}</ol>,
        li: ({ children }) => <li className="my-1">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        code: ({ children }) => {
          const value = String(children ?? "").trim()
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
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

const OP_LABELS: Record<string, string> = {
  equals: "is", not_equals: "is not", contains: "contains", starts_with: "starts with", greater_than: ">", less_than: "<",
  exists: "exists", flagged_by: "flagged by", json_equals: "is", json_not_equals: "is not", json_contains: "contains",
  json_exists: "exists", json_greater_than: ">", json_less_than: "<",
}

function FilterCard({ proposal, state, onApply, onDismiss }: Readonly<{ proposal: FilterProposal; state?: "applied" | "dismissed"; onApply: () => void; onDismiss: () => void }>) {
  return (
    <div className="mt-2.5 rounded-xl border border-[var(--cl-violet-line)] bg-[var(--cl-violet-soft)] p-3">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--cl-violet-text)]">
        <Filter className="h-3.5 w-3.5" /> {proposal.explanation || (proposal.mode === "replace" ? "Replace the filters with" : "Add filters")}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {proposal.filters.map((f, i) => (
          <span key={i} className="rounded-full border border-[var(--cl-border2)] bg-[var(--cl-panel)] px-2 py-0.5 text-[12.5px] text-[var(--cl-text2)]">
            {f.jsonField ? `${f.column === "metadata" ? "metadata" : "disposition"}.${f.jsonField}` : f.column.replaceAll("_", " ")}{" "}
            {OP_LABELS[f.operation] ?? f.operation}
            {f.operation === "exists" || f.operation === "json_exists" ? "" : <b className="font-medium text-[var(--cl-text)]"> {f.value}</b>}
          </span>
        ))}
      </div>
      {proposal.mode === "replace" && !state && <p className="mt-1.5 text-[12px] text-[var(--cl-text3)]">Replaces the filters you have now.</p>}
      <div className="mt-2.5 flex items-center gap-2">
        {state === "applied" ? (
          <span className="inline-flex items-center gap-1 text-[13px] text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> Applied</span>
        ) : state === "dismissed" ? (
          <span className="text-[13px] text-[var(--cl-text3)]">Not applied</span>
        ) : (
          <>
            <button type="button" onClick={onApply} className="h-7 rounded-lg bg-[var(--cl-violet)] px-3 text-[13px] font-medium text-white hover:opacity-90">Apply</button>
            <button type="button" onClick={onDismiss} className="h-7 rounded-lg px-2.5 text-[13px] text-[var(--cl-text2)] hover:bg-[var(--cl-hover)]">Dismiss</button>
          </>
        )}
      </div>
    </div>
  )
}
