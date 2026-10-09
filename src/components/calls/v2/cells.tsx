"use client"

import React, { useState } from "react"
import { Check, Copy, Phone } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDuration, formatToIndianDateTime, isViewerRole } from "@/utils/callLogsUtils"
import type { CallLog } from "@/types/logs"
import { TagEditor } from "../TagEditor"
import { FlagEditor } from "../FlagEditor"

// Cell renderers for the redesigned table. They read the same CallLog fields as
// tableColumns.tsx — only the presentation differs (no icons on plain values,
// quiet pills, controls that appear on row hover).

const Nil = () => <span className="text-[var(--cl-text3)]">—</span>

export function CustomerNumberCell({ call }: Readonly<{ call: CallLog }>) {
  const number = call.customer_number || ""
  const content = (
    <div className="flex min-w-0 max-w-[220px] items-center gap-1.5 font-semibold tabular-nums text-[var(--cl-text)]">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--cl-hover)] text-[var(--cl-text3)]">
        <Phone className="h-[11px] w-[11px]" />
      </span>
      <span className="truncate">{number || "—"}</span>
    </div>
  )
  // Long ids (SIP / international formats) are cut; the tooltip shows them whole.
  if (number.length <= 15) return content
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent><p className="max-w-xs break-all">{number}</p></TooltipContent>
    </Tooltip>
  )
}

export function CallIdCell({ call }: Readonly<{ call: CallLog }>) {
  const [copied, setCopied] = useState(false)
  if (!call.call_id) return <Nil />
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    void navigator.clipboard.writeText(call.call_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="font-mono text-[13px] text-[var(--cl-text2)]">…{call.call_id.slice(-8)}</span>
        </TooltipTrigger>
        <TooltipContent><p className="max-w-xs break-all">{call.call_id}</p></TooltipContent>
      </Tooltip>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy call ID"
        className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded text-[var(--cl-text3)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  )
}

export function DurationCell({ seconds }: Readonly<{ seconds?: number | null }>) {
  return <span className="font-mono tabular-nums text-[var(--cl-text)]">{formatDuration(seconds ?? 0)}</span>
}

export function StartTimeCell({ call }: Readonly<{ call: CallLog }>) {
  if (!call.call_started_at) return <Nil />
  return <span className="text-[var(--cl-text)]">{formatToIndianDateTime(call.call_started_at)}</span>
}

export function CallEventCell({ call }: Readonly<{ call: CallLog }>) {
  if (!call.wcall_event) return <Nil />
  const label = call.wcall_event === "call_ended" ? "Ended" : call.wcall_event === "call_started" ? "Started" : call.wcall_event
  return <span className="text-[var(--cl-text2)]">{label}</span>
}

export function TagsCell({
  call, availableTags, role, onUpdated,
}: Readonly<{ call: CallLog; availableTags: string[]; role: string | null; onUpdated?: () => void }>) {
  const tm = call.transcription_metrics
  return (
    <TagEditor
      variant="quiet"
      callId={call.id}
      initialTags={Array.isArray(tm?.tags) ? tm.tags : []}
      initialTagComments={tm?.tagComments && typeof tm.tagComments === "object" && !Array.isArray(tm.tagComments) ? tm.tagComments : {}}
      availableTags={availableTags}
      canComment={role !== null && !isViewerRole(role)}
      onUpdated={onUpdated}
    />
  )
}

export function FlagCell({
  call, role, currentUserId, currentUserEmail, onUpdated,
}: Readonly<{ call: CallLog; role: string | null; currentUserId: string | null; currentUserEmail: string | null; onUpdated?: () => void }>) {
  return (
    <FlagEditor
      variant="quiet"
      callId={call.id}
      initialFlag={call.transcription_metrics?.flag}
      currentUserId={currentUserId}
      currentUserEmail={currentUserEmail}
      canDeleteAnyFlag={role !== null && !isViewerRole(role)}
      onUpdated={onUpdated}
    />
  )
}
