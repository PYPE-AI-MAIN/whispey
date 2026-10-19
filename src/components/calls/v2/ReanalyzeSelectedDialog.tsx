"use client"

import React, { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { CallLog } from "@/types/logs"
import { V2_BTN, V2_THEME } from "./theme"

type What = "both" | "transcription" | "metrics"

const WHAT_OPTIONS: { value: What; label: string; hint: string }[] = [
  { value: "both", label: "Dispositions and metrics", hint: "Everything that runs after a call" },
  { value: "transcription", label: "Dispositions only", hint: "The field extractor" },
  { value: "metrics", label: "Metrics only", hint: "The evaluation metrics" },
]

/**
 * Reruns the field extractor and/or metrics on the calls picked in the table,
 * through the same analytics lambda job as Reanalyze in the More menu
 * (/api/reprocess-call-logs/selected sends it one call at a time).
 */
export function ReanalyzeSelectedDialog({ open, onOpenChange, calls, agentId, onQueued }: Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  calls: CallLog[]
  agentId: string
  onQueued: () => void
}>) {
  const [what, setWhat] = useState<What>("both")
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" | "error"; text?: string; queued?: number; failed?: number }>({ kind: "idle" })

  const completed = calls.filter((c) => c.call_ended_reason === "completed").length
  const skipped = calls.length - completed

  const close = (next: boolean) => {
    if (!next) setState({ kind: "idle" })
    onOpenChange(next)
  }

  const submit = async () => {
    setState({ kind: "sending" })
    try {
      const res = await fetch("/api/reprocess-call-logs/selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_ids: calls.map((c) => c.id),
          agent_id: agentId,
          reprocess_type: onlyMissing ? "empty_only" : "all",
          reprocess_options: what,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Couldn't start reanalyzing")
      setState({ kind: "done", queued: json.queued ?? 0, failed: json.failed ?? 0 })
      onQueued()
    } catch (e) {
      setState({ kind: "error", text: e instanceof Error ? e.message : "Couldn't start reanalyzing" })
    }
  }

  const done = state.kind === "done"
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={cn("gap-0 overflow-hidden rounded-2xl border-[var(--cl-border)] bg-[var(--cl-panel)] p-0 text-[var(--cl-text)]", V2_THEME)}>
        <div className="border-b border-[var(--cl-border)] px-6 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
            <Sparkles className="h-4 w-4 text-[var(--cl-violet)]" />
            Reanalyze {calls.length} {calls.length === 1 ? "call" : "calls"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-[var(--cl-text3)]">
            Runs them again with the agent&apos;s current field extractor and metrics.
          </DialogDescription>
        </div>

        {done ? (
          <output className="block px-6 py-6 text-[13.5px]">
            <span className="block font-medium">
              Reanalyzing {state.queued} {state.queued === 1 ? "call" : "calls"}.
            </span>
            <span className="mt-1 block text-[var(--cl-text3)]">New values show up in a minute or two. Refresh to see them.</span>
            {!!state.failed && (
              <span className="mt-2 block text-[var(--cl-red-text)]">{state.failed} couldn&apos;t be started. Try those again.</span>
            )}
          </output>
        ) : (
          <div className="space-y-5 px-6 py-5">
            <fieldset>
              <legend className="mb-2 text-[12.5px] font-medium text-[var(--cl-text2)]">What to run again</legend>
              <div className="space-y-1.5">
                {WHAT_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    htmlFor={`reanalyze-what-${o.value}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                      what === o.value ? "border-[var(--cl-accent-line)] bg-[var(--cl-accent-soft)]" : "border-[var(--cl-border)] hover:bg-[var(--cl-hover)]",
                    )}
                  >
                    <input
                      id={`reanalyze-what-${o.value}`}
                      type="radio"
                      name="reanalyze-what"
                      value={o.value}
                      checked={what === o.value}
                      onChange={() => setWhat(o.value)}
                      className="accent-[var(--cl-accent)]"
                    />
                    <span className="min-w-0 text-[13.5px] font-medium">
                      {o.label}
                      <span className="block text-[12px] font-normal text-[var(--cl-text3)]">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label htmlFor="reanalyze-only-missing" className="flex cursor-pointer items-start gap-2.5 text-[13px]">
              <input
                id="reanalyze-only-missing"
                type="checkbox"
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
                className="mt-0.5 accent-[var(--cl-accent)]"
              />
              <span>
                <span className="block">Only fill in missing values</span>
                <span className="block text-[12px] text-[var(--cl-text3)]">Leaves calls that already have results as they are.</span>
              </span>
            </label>

            {skipped > 0 && (
              <p className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel2)] px-3 py-2 text-[12.5px] text-[var(--cl-text2)]">
                {skipped} of these {skipped === 1 ? "call" : "calls"} didn&apos;t complete, so {skipped === 1 ? "it's" : "they're"} skipped.
              </p>
            )}
            {state.kind === "error" && (
              <p role="alert" className="text-[13px] text-[var(--cl-red-text)]">{state.text}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--cl-border)] bg-[var(--cl-panel2)] px-6 py-3">
          <button type="button" onClick={() => close(false)} className={V2_BTN}>
            {done ? "Done" : "Cancel"}
          </button>
          {!done && (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={state.kind === "sending" || completed === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--cl-accent)] px-3 text-[13.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
            >
              {state.kind === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Reanalyze
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
