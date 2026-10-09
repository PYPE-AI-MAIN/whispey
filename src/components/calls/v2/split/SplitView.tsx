"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import AudioPlayer, { type AudioPlayerControls } from "@/components/AudioPlayer"
import { useCallTranscript } from "@/hooks/useCallTranscript"
import { useTranscriptEnglishToggle } from "@/hooks/useTranscriptEnglishToggle"
import { useCallLogsStore } from "@/stores/callLogsStore"
import { extractS3Key } from "@/utils/s3"
import type { CallLog } from "@/types/logs"
import type { PhoneNumber } from "@/lib/callDispatch"
import { cn } from "@/lib/utils"
import { CallList } from "./CallList"
import { CallDetail } from "./CallDetail"
import { CallInspector } from "./CallInspector"
import { keyboardIsBusy } from "../keyboard"
import { SUMMARY_FIELD, activeCueKey, extractorKeys, recordingTimeZero, transcriptCues } from "./callData"

interface SplitViewProps {
  call: CallLog
  calls: CallLog[]
  agent: any
  projectId: string
  role: string | null
  currentUserId: string | null
  currentUserEmail: string | null
  availableTags: string[]
  onUpdated: () => void
  canOfferCallAgain: boolean
  outboundPhoneNumbers: PhoneNumber[]
  onOpen: (call: CallLog) => void
  onClose: () => void
  /** Another page of calls is loading. */
  listLoading?: boolean
  listFooter: React.ReactNode
}

// Renders nothing: mounting it runs the same transcript queries the open call
// uses (same React Query keys), so the result is already cached when opened.
export function PrefetchTranscript({ callId, agentId }: Readonly<{ callId: string; agentId: string }>) {
  useCallTranscript({ sessionId: callId, agentId, light: true })
  return null
}

// A call opened beside the list: list (25%) · call (50%) · call data (25%, or a
// thin strip when folded). The recording bar runs under the call and its data,
// so folding the right pane never moves it.
export function SplitView(props: Readonly<SplitViewProps>) {
  const { call, calls, agent, role, onOpen, onClose, listLoading = false, listFooter } = props
  const collapsed = useCallLogsStore((s) => s.rightPanelCollapsed)
  const setCollapsed = useCallLogsStore((s) => s.setRightPanelCollapsed)
  const [inspectorTab, setInspectorTab] = useState<"data" | "tools">("data")
  const [focusedToolKey, setFocusedToolKey] = useState<string | null>(null)

  const hasSummaryField = useMemo(() => extractorKeys(agent).includes(SUMMARY_FIELD), [agent])

  const { turns, traceDataLoading, checkBugReportFlags } = useCallTranscript({ sessionId: call.id, agentId: agent.id, light: true })

  // Warm the cache for the calls either side (J/K / ↑↓) and the one under the pointer.
  const index = calls.findIndex((c) => c.id === call.id)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefetchSoon = useCallback((c: CallLog) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHoverId(c.id), 120)
  }, [])
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }, [])
  const prefetchIds = [...new Set([calls[index + 1]?.id, calls[index - 1]?.id, hoverId])].filter((id): id is string => !!id && id !== call.id)
  const english = useTranscriptEnglishToggle(turns)

  // Recording ↔ transcript: the bubble being heard is highlighted, and a
  // bubble's timestamp jumps the recording there.
  const timeZero = useMemo(() => recordingTimeZero(turns, call.call_started_at), [turns, call.call_started_at])
  const cues = useMemo(() => transcriptCues(turns, timeZero), [turns, timeZero])
  const playerRef = useRef<AudioPlayerControls>(null)
  const [activeCue, setActiveCue] = useState<string | null>(null)
  const onPlayhead = useCallback((seconds: number) => setActiveCue(activeCueKey(cues, seconds)), [cues])
  const seekTo = useCallback((seconds: number) => playerRef.current?.seek(seconds), [])

  // Recording keys, as in the mockup: Space plays/pauses, ← / → jump 5 seconds.
  const rootRef = useRef<HTMLDivElement>(null)
  const hasRecording = !!call.recording_url
  useEffect(() => {
    if (!hasRecording) return
    const onKey = (e: KeyboardEvent) => {
      if (!rootRef.current?.offsetParent || keyboardIsBusy(e) || e.metaKey || e.ctrlKey || e.altKey) return
      const player = playerRef.current
      if (!player) return
      if (e.key === " ") player.toggle()
      else if (e.key === "ArrowLeft") player.skip(-5)
      else if (e.key === "ArrowRight") player.skip(5)
      else return
      e.preventDefault()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [hasRecording])

  // A different call starts on its data, with nothing focused or playing.
  useEffect(() => {
    setFocusedToolKey(null)
    setActiveCue(null)
  }, [call.id])

  const openTool = (key: string) => {
    if (collapsed) setCollapsed(false)
    setInspectorTab("tools")
    setFocusedToolKey(key)
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] transition-[grid-template-columns] duration-200",
        collapsed ? "grid-cols-[25%_minmax(0,1fr)_44px]" : "grid-cols-[25%_minmax(0,1fr)_25%]"
      )}
    >
      <div className="row-span-2 flex min-h-0">
        <div className="flex min-h-0 w-full flex-col">
          <CallList
            calls={calls}
            openId={call.id}
            role={role}
            hasSummaryField={hasSummaryField}
            onOpen={onOpen}
            onBack={onClose}
            onHover={prefetchSoon}
            loading={listLoading}
            footer={listFooter}
          />
        </div>
      </div>

      <CallDetail
        {...props}
        hasSummaryField={hasSummaryField}
        turns={turns}
        transcriptLoading={traceDataLoading}
        bugReportTurnIds={checkBugReportFlags}
        viewEnglish={english.viewEnglish}
        setViewEnglish={english.setViewEnglish}
        isTranslating={english.isTranslating}
        formatTranscript={english.formatTranscript}
        onOpenTool={openTool}
        timeZero={timeZero}
        cues={cues}
        activeCue={activeCue}
        onSeek={call.recording_url ? seekTo : undefined}
      />

      <CallInspector
        call={call}
        agentId={agent.id}
        role={role}
        turns={turns}
        tab={inspectorTab}
        onTabChange={setInspectorTab}
        focusedToolKey={focusedToolKey}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
      />

      {/* Neighbours wait for the open call's transcript, so they don't compete
          with it (or the recording) for the browser's few connections per host. */}
      {!traceDataLoading && prefetchIds.map((id) => <PrefetchTranscript key={id} callId={id} agentId={agent.id} />)}

      {/* The existing player for now; restyling it comes later. */}
      <div className="col-span-2 col-start-2 border-t border-[var(--cl-border)] bg-[var(--cl-panel)] px-4 py-2">
        {call.recording_url ? (
          <AudioPlayer key={call.id} s3Key={extractS3Key(call.recording_url)} url={call.recording_url} callId={call.id} controlRef={playerRef} onTimeUpdate={onPlayhead} preload className="border-0 bg-transparent p-0 shadow-none dark:bg-transparent" />
        ) : (
          <p className="py-2 text-center text-[13px] text-[var(--cl-text3)]">No recording for this call.</p>
        )}
      </div>
    </div>
  )
}
