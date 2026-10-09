"use client"

import React from "react"
import { Sparkles } from "lucide-react"
import { useCallLogsStore } from "@/stores/callLogsStore"

// Shown on the legacy page while the redesigned Call Logs is opt-in. The shimmer
// is the only thing that makes it read as "new" — no badge, no banner — so it
// stays one quiet button in a toolbar that already has plenty of them.
export function TryNewViewButton() {
  const setViewMode = useCallLogsStore((s) => s.setViewMode)
  return (
    <button
      type="button"
      onClick={() => setViewMode("new")}
      className="relative inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-md bg-gradient-to-r from-violet-600 to-blue-600 px-3 text-xs font-semibold text-white shadow-sm shadow-violet-500/25 transition-shadow hover:shadow-md hover:shadow-violet-500/40"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 animate-[shimmer_2.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent"
      />
      <Sparkles className="h-3.5 w-3.5" />
      Try the new Call Logs
    </button>
  )
}
