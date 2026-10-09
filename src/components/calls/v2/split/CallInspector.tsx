"use client"

import React, { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronsRight } from "lucide-react"
import { useSupabaseQuery } from "@/hooks/useSupabase"
import { useCallLogsStore } from "@/stores/callLogsStore"
import { isColumnVisibleForRole } from "@/utils/callLogsUtils"
import type { TraceLog } from "@/hooks/useCallTranscript"
import type { CallLog } from "@/types/logs"
import { cn } from "@/lib/utils"
import { formatValue, maskForRole, splitTranscriptionMetrics, visibleMetadata } from "./callData"
import { CopyButton, toolFailed, toolKey, toolName } from "./CallDetail"

interface CallInspectorProps {
  call: CallLog
  agentId: string
  role: string | null
  turns: TraceLog[]
  tab: "data" | "tools"
  onTabChange: (tab: "data" | "tools") => void
  focusedToolKey: string | null
  collapsed: boolean
  onToggleCollapsed: () => void
}

// The right pane: everything known about the call, grouped and folded away
// until asked for. Tools lists every tool call with its raw input and output.
export function CallInspector(props: Readonly<CallInspectorProps>) {
  const { collapsed, onToggleCollapsed, tab, onTabChange, turns } = props
  const [showEmpty, setShowEmpty] = useState(false)
  const tools = turns.flatMap((t) => (Array.isArray(t.tool_calls) ? t.tool_calls.map((tool, i) => ({ key: toolKey(t.turn_id, i), tool })) : []))
  const anyFailed = tools.some(({ tool }) => toolFailed(tool))

  if (collapsed) {
    return (
      <section
        role="button"
        tabIndex={0}
        aria-label="Show call data"
        title="Show call data (⌘ ])"
        onClick={onToggleCollapsed}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleCollapsed() }}
        className="group grid min-h-0 cursor-pointer place-items-center border-l border-[var(--cl-border)] bg-[var(--cl-panel)] transition-colors hover:bg-[var(--cl-hover)]"
      >
        <span className="grid h-14 w-8 place-items-center rounded-lg text-[var(--cl-text2)] group-hover:bg-[var(--cl-border)] group-hover:text-[var(--cl-text)]">
          <ChevronsRight className="h-5 w-5 rotate-180" />
        </span>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col border-l border-[var(--cl-border)] bg-[var(--cl-panel)]">
      <div className="flex flex-none items-center gap-2 border-b border-[var(--cl-border)] px-3 py-2.5">
        <div className="flex rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel2)] p-0.5" role="tablist">
          <TabButton active={tab === "data"} onClick={() => onTabChange("data")}>Call data</TabButton>
          <TabButton active={tab === "tools"} onClick={() => onTabChange("tools")}>
            Tools
            <span className={cn("ml-1.5 rounded-full px-1.5 text-[11px]", anyFailed ? "bg-[var(--cl-red-soft)] text-[var(--cl-red-text)]" : "bg-[var(--cl-hover)] text-[var(--cl-text3)]")}>
              {tools.length}
            </span>
          </TabButton>
        </div>
        {tab === "data" && (
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12.5px] text-[var(--cl-text3)]">
            <input type="checkbox" className="sr-only" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
            <span className={cn("relative h-[15px] w-[26px] rounded-full transition-colors", showEmpty ? "bg-[var(--cl-accent)]" : "bg-[var(--cl-border2)]")}>
              <span className={cn("absolute top-[2px] h-[11px] w-[11px] rounded-full bg-white shadow transition-all", showEmpty ? "left-[13px]" : "left-[2px]")} />
            </span>
            Empty
          </label>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Collapse panel (⌘ ])"
          aria-label="Collapse panel"
          className={cn("grid h-[26px] w-[26px] place-items-center rounded-md text-[var(--cl-text3)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]", tab !== "data" && "ml-auto")}
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "data" ? <CallDataGroups {...props} showEmpty={showEmpty} /> : <ToolsList tools={tools} {...props} />}
      </div>
    </section>
  )
}

function TabButton({ active, onClick, children }: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-md px-3 py-1 text-[13px] text-[var(--cl-text2)]",
        active && "bg-[var(--cl-raised)] text-[var(--cl-text)] shadow-[0_0_0_1px_var(--cl-border2)]"
      )}
    >
      {children}
    </button>
  )
}

function CallDataGroups({ call, agentId, role, showEmpty }: Readonly<CallInspectorProps & { showEmpty: boolean }>) {
  const openGroups = useCallLogsStore((s) => s.openInspectorGroups)
  const setOpenGroups = useCallLogsStore((s) => s.setOpenInspectorGroups)
  const toggle = (id: string) => setOpenGroups(openGroups.includes(id) ? openGroups.filter((g) => g !== id) : [...openGroups, id])

  // dynamic_variables is left out of the list query (it can be large), so it is
  // fetched for the open call only — one row, so its count is known up front.
  const varsOpen = openGroups.includes("vars")
  const { data: varsRows, isLoading: varsLoading } = useSupabaseQuery<{ dynamic_variables: Record<string, unknown> | null }>(
    "pype_voice_call_logs",
    { select: "id, dynamic_variables", filters: [{ column: "id", operator: "eq", value: call.id }], limit: 1, auth: { agentId } }
  )

  const { dispositions, checks } = splitTranscriptionMetrics(call)
  const passed = checks.filter(([, v]) => v === true).length
  const failed = checks.filter(([, v]) => v === false).length
  const variables = Object.entries(varsRows?.[0]?.dynamic_variables ?? {})
  const metadata = visibleMetadata(call)
  const metrics = Object.entries((call.metrics ?? {}) as Record<string, { score?: number; reason?: string }>)
  const costParts = [call.total_llm_cost, call.total_tts_cost, call.total_stt_cost].filter((v): v is number => typeof v === "number")
  // The list query has no total_cost column, so the total is the sum of its parts.
  const totalCost = typeof call.total_cost === "number" ? call.total_cost : costParts.length ? costParts.reduce((a, b) => a + b, 0) : null
  const showCost = isColumnVisibleForRole("total_llm_cost", role) && totalCost !== null
  const keep = (rows: Array<[string, unknown]>) => (showEmpty ? rows : rows.filter(([, v]) => formatValue(v) !== ""))

  return (
    <>
      <Group id="disp" title="Dispositions" count={keep(dispositions).length} open={openGroups.includes("disp")} onToggle={toggle}>
        <KeyValues rows={keep(dispositions)} role={role} />
      </Group>
      {checks.length > 0 && (
        <Group
          id="checks" title="QA checks" open={openGroups.includes("checks")} onToggle={toggle}
          count={<><span>{passed} ✓</span>{failed > 0 && <span className="text-[var(--cl-red-text)]"> · {failed} ✕</span>}</>}
        >
          <KeyValues rows={keep(checks)} role={role} />
        </Group>
      )}
      <Group id="vars" title="Call variables" count={varsLoading ? null : keep(variables).length} open={varsOpen} onToggle={toggle}>
        {varsLoading ? <p className="py-1 text-[12.5px] text-[var(--cl-text3)]">Loading…</p> : <KeyValues rows={keep(variables)} role={role} />}
      </Group>
      {metrics.length > 0 && (
        <Group id="metrics" title="Metrics" count={metrics.length} open={openGroups.includes("metrics")} onToggle={toggle}>
          {metrics.map(([id, m]) => {
            const score = typeof m?.score === "number" ? m.score : null
            const pct = score === null ? 0 : Math.max(0, Math.min(1, score)) * 100
            let tone = "bg-rose-500"
            if (score !== null && score >= 0.7) tone = "bg-emerald-500"
            else if (score !== null && score >= 0.5) tone = "bg-amber-500"
            return (
              <div key={id} className="border-t border-dashed border-[var(--cl-border)] py-1.5 first:border-t-0">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="w-[42%] shrink-0 truncate font-mono text-[var(--cl-text3)]" title={id}>{id}</span>
                  <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-[var(--cl-border2)]"><i className={cn("block h-full", tone)} style={{ width: `${pct}%` }} /></span>
                  <span className="font-mono">{score === null ? "—" : score.toFixed(2)}</span>
                </div>
                {m?.reason && <p className="mt-0.5 text-[12.5px] text-[var(--cl-text3)]">{m.reason}</p>}
              </div>
            )
          })}
        </Group>
      )}
      <Group id="meta" title="Metadata" count={keep(metadata).length} open={openGroups.includes("meta")} onToggle={toggle}>
        <KeyValues rows={keep(metadata)} role={role} />
      </Group>
      {showCost && (
        <Group id="cost" title="Cost" count={`₹ ${Number(totalCost).toFixed(2)}`} open={openGroups.includes("cost")} onToggle={toggle}>
          <KeyValues
            role={role}
            rows={[
              ["Total Cost (₹)", totalCost === null ? null : Number(totalCost).toFixed(2)],
              ["LLM Cost (₹)", call.total_llm_cost],
              ["TTS Cost (₹)", call.total_tts_cost],
              ["STT Cost (₹)", call.total_stt_cost],
            ]}
          />
        </Group>
      )}
    </>
  )
}

function Group({
  id, title, count, open, onToggle, children,
}: Readonly<{ id: string; title: string; count: React.ReactNode; open: boolean; onToggle: (id: string) => void; children: React.ReactNode }>) {
  return (
    <div className="border-b border-[var(--cl-border)]">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-[11px] text-left text-[13px] font-semibold uppercase tracking-[.06em] text-[var(--cl-text2)] hover:text-[var(--cl-text)]"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
        {title}
        {count != null && <span className="ml-auto rounded-full bg-[var(--cl-hover)] px-[7px] text-[11.5px] font-medium normal-case tracking-normal text-[var(--cl-text3)]">{count}</span>}
      </button>
      {open && <div className="px-3.5 pb-3">{children}</div>}
    </div>
  )
}

function KeyValues({ rows, role }: Readonly<{ rows: Array<[string, unknown]>; role: string | null }>) {
  if (rows.length === 0) return <p className="py-1 text-[12.5px] italic text-[var(--cl-text3)]">Nothing here</p>
  return (
    <>
      {rows.map(([key, value]) => {
        const text = maskForRole(formatValue(value), role)
        return (
          <div key={key} className="group/kv grid grid-cols-[48%_1fr] gap-2.5 border-t border-dashed border-[var(--cl-border)] py-1.5 text-[13.5px] first:border-t-0">
            <span className="truncate font-mono text-[12.5px] text-[var(--cl-text3)]" title={key}>{key}</span>
            <span className={cn("relative break-words pr-6", text ? "text-[var(--cl-text)]" : "italic text-[var(--cl-text3)]")}>
              {text || "empty"}
              {text && (
                <span className="absolute right-0 top-0 opacity-0 group-hover/kv:opacity-100">
                  <CopyButton text={text} label={`Copy ${key}`} />
                </span>
              )}
            </span>
          </div>
        )
      })}
    </>
  )
}

function ToolsList({
  tools, focusedToolKey, role,
}: Readonly<CallInspectorProps & { tools: Array<{ key: string; tool: any }> }>) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const focusedRef = useRef<HTMLDivElement>(null)

  // Clicking a tool pill in the transcript opens and scrolls to it here.
  useEffect(() => {
    if (!focusedToolKey) return
    setOpen((prev) => new Set(prev).add(focusedToolKey))
    requestAnimationFrame(() => focusedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }))
  }, [focusedToolKey])

  if (tools.length === 0) return <p className="px-4 py-10 text-center text-[13px] text-[var(--cl-text3)]">No tools were called on this call.</p>

  return (
    <>
      {tools.map(({ key, tool }) => {
        const failed = toolFailed(tool)
        const isOpen = open.has(key)
        const args = tool.arguments == null ? null : maskForRole(typeof tool.arguments === "string" ? tool.arguments : JSON.stringify(tool.arguments, null, 2), role)
        const result = tool.result == null ? null : maskForRole(String(tool.result), role)
        return (
          <div key={key} ref={key === focusedToolKey ? focusedRef : undefined} className={cn("border-b border-[var(--cl-border)]", failed && "shadow-[inset_3px_0_0_var(--cl-red)]")}>
            <button
              type="button"
              onClick={() => setOpen((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--cl-hover)]"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 text-[var(--cl-text3)] transition-transform", !isOpen && "-rotate-90")} />
              <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", failed ? "bg-[var(--cl-red)]" : "bg-[var(--cl-text3)]")} />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{toolName(tool)}</span>
              {typeof tool.duration_ms === "number" && <span className="font-mono text-[12px] text-[var(--cl-text3)]">{Math.round(tool.duration_ms)}ms</span>}
            </button>
            {isOpen && (
              <div className="px-3 pb-3 pt-0.5">
                {failed && result && <p className="mb-2 rounded-lg border border-[var(--cl-red-line)] bg-[var(--cl-red-soft)] px-2.5 py-2 text-[13px] text-[var(--cl-red-text)]">✕ {result}</p>}
                <JsonBlock title="Arguments" text={args} />
                <JsonBlock title={failed ? "Error response" : "Response"} text={result} />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function JsonBlock({ title, text }: Readonly<{ title: string; text: string | null }>) {
  return (
    <>
      <div className="mb-1 mt-2 flex items-center justify-between text-[11.5px] font-semibold uppercase tracking-[.07em] text-[var(--cl-text3)]">
        {title}
        {text && <CopyButton text={text} label={`Copy ${title.toLowerCase()}`} />}
      </div>
      <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--cl-border)] bg-[var(--cl-bg)] p-2.5 font-mono text-[12.5px] text-[var(--cl-text2)]">
        {text ?? "—"}
      </pre>
    </>
  )
}

