"use client"

import React from "react"
import type { CallLog } from "@/types/logs"

// Completed is the normal case, so it gets no marker at all — only calls that
// ended some other way get a small muted dot, which keeps the column scannable
// for problems without painting every row.
export function StatusCell({ call }: Readonly<{ call: CallLog }>) {
  if (call.wcall_event === "call_started") return <span className="text-[var(--cl-text3)]">—</span>
  const status = call.call_ended_reason
  if (!status) return <span className="text-[var(--cl-text3)]">—</span>
  const isCompleted = status === "completed"
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--cl-text2)]">
      {!isCompleted && <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--cl-st-fail)]" />}
      {status}
    </span>
  )
}
