'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Eye, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useVoiceAgent, type Transcript } from '@/hooks/useVoiceAgent'
import { saveAndDeployAgent, useUpdateProgressLabel, checkUpdateInProgress } from '@/hooks/useAgentConfig'
import { useCallLogs } from '@/hooks/useCallLogs'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { canShowOrgSection } from '@/types/visibility'
import InsightsStrip from '@/components/agents/AgentStudio/InsightsStrip'
import OutputVariablesPanel from '@/components/agents/AgentStudio/OutputVariablesPanel'
import StudioEmptyState from '@/components/agents/AgentStudio/StudioEmptyState'
import TestAgentPanel from '@/components/agents/AgentStudio/TestAgentPanel'
import type { LastCallState, TurnPreview } from '@/components/agents/AgentStudio/LastCallCard'
import { useStudio } from './_context'

// How long after a test call ends we'll keep polling for its call-log row
// before giving up and showing a "check Call Logs" fallback instead.
const LAST_CALL_POLL_TIMEOUT_MS = 90 * 1000
const LAST_CALL_POLL_INTERVAL_MS = 3000

/**
 * Watches the test call's connect/disconnect edges and polls for the
 * matching pype_voice_call_logs row once a call ends — there's no shared
 * session id available client-side (the room name and the backend's own
 * call_id are generated independently), so this correlates by agent_id +
 * "newest call_ended row created after this test call started."
 */
function useLastTestCall(agentId: string, isConnected: boolean, liveTranscripts: Transcript[]) {
  const [state, setState] = useState<LastCallState>({ status: 'loading' })
  const wasConnectedRef = useRef(false)
  // Last non-empty live transcript of the current/most recent call. Kept in a
  // ref because disconnect() clears the hook's transcripts in the same batch
  // that flips isConnected, so by the time the hang-up effect runs they're gone.
  const liveTurnsRef = useRef<TurnPreview[]>([])
  // Id of the newest completed call known BEFORE this test call started. A row
  // with a different id is the new one. (Comparing created_at to the call start
  // is unreliable: Supabase returns timestamps without a zone, which the browser
  // then reads as local time — hours off outside UTC — so it never matched.)
  const knownLatestIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (liveTranscripts.length > 0) {
      liveTurnsRef.current = liveTranscripts
        .filter((t) => t.text?.trim())
        .map((t) => ({ id: t.id, speaker: t.speaker, text: t.text }))
    }
  }, [liveTranscripts])

  useEffect(() => {
    if (isConnected && !wasConnectedRef.current) {
      liveTurnsRef.current = []
    }
    if (!isConnected && wasConnectedRef.current) {
      setState({ status: 'waiting', turns: liveTurnsRef.current })
    }
    wasConnectedRef.current = isConnected
  }, [isConnected])

  const isWaiting = state.status === 'waiting'
  const callRowFilters = [{ column: 'wcall_event', operator: 'eq', value: 'call_ended' }]

  const { data: rows } = useCallLogs({
    agentId,
    preDistinctFilters: callRowFilters,
    postDistinctFilters: [],
    orderBy: { column: 'created_at', ascending: false },
    page: 1,
    enabled: isWaiting,
    refetchInterval: isWaiting ? LAST_CALL_POLL_INTERVAL_MS : false,
    staleTime: 0,
    gcTime: 60 * 1000,
  })

  // Runs once on mount to surface whatever the most recently completed call
  // already is — component state resets on refresh/navigation, and without this
  // a call that already landed shows nothing until the next one.
  const isInitialLoad = state.status === 'loading'
  const { data: initialRows, isFetched: initialFetched } = useCallLogs({
    agentId,
    preDistinctFilters: callRowFilters,
    postDistinctFilters: [],
    orderBy: { column: 'created_at', ascending: false },
    page: 1,
    enabled: isInitialLoad,
    refetchInterval: false,
    staleTime: 0,
    gcTime: 60 * 1000,
  })

  useEffect(() => {
    if (state.status !== 'loading' || !initialFetched) return
    const latest = initialRows?.[0]
    knownLatestIdRef.current = latest?.id ?? null
    setState(latest ? { status: 'ready', call: latest } : { status: 'idle' })
  }, [initialRows, initialFetched, state])

  useEffect(() => {
    if (state.status !== 'waiting' || !rows?.[0]) return
    const latest = rows[0]
    if (latest.id !== knownLatestIdRef.current) {
      knownLatestIdRef.current = latest.id
      setState({ status: 'ready', call: latest })
    }
  }, [rows, state])

  useEffect(() => {
    if (state.status !== 'waiting') return
    const t = setTimeout(() => {
      setState((s) => (s.status === 'waiting' ? { status: 'timeout', turns: s.turns } : s))
    }, LAST_CALL_POLL_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [state])

  const retry = useCallback(() => {
    setState((s) => ({ status: 'waiting', turns: s.status === 'timeout' ? s.turns : liveTurnsRef.current }))
  }, [])

  return { lastCallState: state, retryLastCall: retry }
}

function useCurrentAssistantConfig(backendAgentName: string) {
  return useQuery({
    queryKey: ['studio-agent-config', backendAgentName],
    queryFn: async () => {
      const res = await fetch(`/api/agent-config/${encodeURIComponent(backendAgentName)}`)
      if (!res.ok) throw new Error('Failed to load agent config')
      const data = await res.json()
      return data?.agent ?? null
    },
    enabled: !!backendAgentName,
    staleTime: 30 * 1000,
  })
}

function StudioWorkspace({ isPreview, onExitPreview }: Readonly<{ isPreview: boolean; onExitPreview: () => void }>) {
  const { agent, agentId, projectId, backendAgentName, refetchAgent } = useStudio()
  const { isOwnerOrAdmin, visibility } = useMemberVisibility(projectId || undefined)
  // Same rule the API enforces on PATCH (fieldExtractor visibility) — so viewers
  // without it don't get an editor that would only fail on save.
  const canEditDispositions = !!isOwnerOrAdmin || canShowOrgSection(visibility, 'fieldExtractor')

  const { data: liveAgentConfig, refetch: refetchConfig } = useCurrentAssistantConfig(backendAgentName)
  const assistant = liveAgentConfig?.assistant?.[0] ?? null
  const tts = assistant?.tts ?? null

  const [voiceSaving, setVoiceSaving] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [sessionVariables, setSessionVariables] = useState<Record<string, string>>({})
  // Same live stage label the real config page shows while it deploys
  // ("Validating config…" → "Stopping current worker…" → … → "Verifying…") —
  // no guessed duration, just what the backend is actually doing right now.
  // Only active while THIS page triggered a voice change — a deploy started
  // externally (e.g. through the MCP) is instead caught by a one-shot check
  // right before a call starts (see handleConnect below), not by polling in
  // the background the whole time this page happens to be open.
  const voiceUpdateLabel = useUpdateProgressLabel(backendAgentName, voiceSaving)

  // LiveKit test call — same connection name the playground and config pages use.
  const [call, callActions] = useVoiceAgent({ agentName: backendAgentName, mode: 'voice' })

  const { lastCallState, retryLastCall } = useLastTestCall(agentId, call.isConnected, call.transcripts)
  // Instant dispositions: the saved call's values come from a slow downstream
  // pipeline, but the live transcript is already here at hang-up — extract from
  // that right away and let the saved values replace it once they land.
  const [previewValues, setPreviewValues] = useState<Record<string, string> | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const waitingTurns = lastCallState.status === 'waiting' ? lastCallState.turns : null
  const extractorOn = !!agent?.field_extractor

  useEffect(() => {
    if (call.isConnecting) setPreviewValues(null)
  }, [call.isConnecting])

  useEffect(() => {
    if (!waitingTurns || waitingTurns.length === 0 || !extractorOn) return
    let cancelled = false
    setPreviewLoading(true)
    fetch(`/api/agents/${agentId}/dispositions/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns: waitingTurns }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.values) setPreviewValues(j.values) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [waitingTurns, agentId, extractorOn])

  const savedValues =
    lastCallState.status === 'ready'
    && lastCallState.call.transcription_metrics
    && typeof lastCallState.call.transcription_metrics === 'object'
    && !Array.isArray(lastCallState.call.transcription_metrics)
    && Object.keys(lastCallState.call.transcription_metrics).length > 0
      ? (lastCallState.call.transcription_metrics as Record<string, string>)
      : null
  const dispositionValues = savedValues ?? previewValues
  const dispositionsLoading =
    lastCallState.status === 'loading'
    || previewLoading
    || (lastCallState.status === 'waiting' && !previewValues && extractorOn)

  const lastCallHref =
    lastCallState.status === 'ready'
      ? `/${projectId}/agents/${agentId}/observability?session_id=${lastCallState.call.id}`
      : undefined

  const handleVoiceSelect = useCallback(
    async (voiceId: string, provider: string, model?: string) => {
      if (!backendAgentName || !liveAgentConfig?.assistant?.[0]) return
      setVoiceSaving(true)
      setVoiceError(null)
      try {
        const currentAssistant = liveAgentConfig.assistant[0]
        // Drop the old voice_settings — it's provider-specific (Sarvam's
        // enable_preprocessing/loudness aren't valid ElevenLabs VoiceSettings
        // fields and vice versa) and carrying it over when switching provider
        // fails backend validation, which silently rolls back the whole save.
        // We don't collect per-voice settings in this minimal picker anyway,
        // so let the backend apply its own defaults for the new provider.
        const ttsBase = { ...currentAssistant.tts }
        delete ttsBase.voice_settings
        const updatedAssistant = {
          ...currentAssistant,
          tts: { ...ttsBase, name: provider, voice_id: voiceId, ...(model ? { model } : {}) },
        }
        // Waits for the redeploy to actually finish (agent worker back up with
        // the new voice), not just for the request to be accepted — same
        // helper the full config page uses. A fixed delay here previously
        // raced the write: the save was accepted, the refetch ran too early,
        // the still-old config came back, and it looked like the voice never
        // saved even though it eventually did.
        await saveAndDeployAgent({ agent: { ...liveAgentConfig, assistant: [updatedAssistant] } })
        await refetchConfig()
      } catch (err: any) {
        console.error('[Studio] voice update failed:', err)
        setVoiceError("We couldn't apply that voice. Please try again, or refresh the page.")
      } finally {
        setVoiceSaving(false)
      }
    },
    [backendAgentName, liveAgentConfig, refetchConfig]
  )

  // Checked once, right when someone tries to start a call — not polled in
  // the background — so a deploy started externally (e.g. through the MCP)
  // still blocks the call, without paying a continuous polling cost for the
  // common case where nothing external is happening.
  //
  // connectGateRef guards the window between click and callActions.connect()
  // actually flipping isConnecting to true — that gap now includes an await
  // (the update-status check), so without this a second click in that window
  // passed useVoiceAgent's own guard too and dispatched a second agent into
  // the same room-less session, producing two agents answering at once.
  const connectGateRef = useRef(false)
  // The pre-check + LiveKit handshake take a few seconds before the hook's own
  // isConnecting flips on; `starting` covers that gap so a click shows progress
  // immediately instead of looking like nothing happened.
  const [starting, setStarting] = useState(false)
  const cancelStartRef = useRef(false)
  const handleConnect = useCallback(async () => {
    if (!backendAgentName || connectGateRef.current) return
    connectGateRef.current = true
    cancelStartRef.current = false
    setStarting(true)
    try {
      const { inProgress, label } = await checkUpdateInProgress(backendAgentName)
      if (cancelStartRef.current) return
      if (inProgress) {
        setVoiceError(label ?? 'An update is currently in progress — try again in a moment.')
        return
      }
      await callActions.connect({ variables: sessionVariables })
    } catch (err) {
      console.error('[Studio] start call failed:', err)
      setVoiceError('Something went wrong starting the call. Try again, or refresh the page.')
    } finally {
      connectGateRef.current = false
      setStarting(false)
    }
  }, [backendAgentName, callActions, sessionVariables])

  const handleDisconnect = useCallback(async () => {
    cancelStartRef.current = true
    await callActions.disconnect()
  }, [callActions])

  // Setup edits are only a draft until they're saved: compare against what the
  // agent actually has, so typing never saves anything by itself and the button
  // can say plainly whether starting will also update the agent.
  const savedVariables: Record<string, string> = assistant?.variables ?? {}
  const hasPendingChanges =
    !!assistant &&
    Object.keys(sessionVariables).some((k) => (sessionVariables[k] ?? '') !== (savedVariables[k] ?? ''))

  const handleUpdateAndStart = useCallback(async () => {
    if (!backendAgentName || !liveAgentConfig?.assistant?.[0] || connectGateRef.current) return
    // voiceSaving drives the greyed button + live deploy-stage label, same as a voice change
    setVoiceSaving(true)
    setVoiceError(null)
    try {
      const currentAssistant = liveAgentConfig.assistant[0]
      const updatedAssistant = {
        ...currentAssistant,
        variables: { ...currentAssistant.variables, ...sessionVariables },
      }
      // Waits for the redeploy to finish, so the call starts on the updated agent.
      await saveAndDeployAgent({ agent: { ...liveAgentConfig, assistant: [updatedAssistant] } })
      await refetchConfig()
    } catch (err) {
      console.error('[Studio] update before start failed:', err)
      setVoiceError("We couldn't update the agent. Please try again, or refresh the page.")
      setVoiceSaving(false)
      return
    }
    setVoiceSaving(false)
    await handleConnect()
  }, [backendAgentName, liveAgentConfig, sessionVariables, refetchConfig, handleConnect])

  // "Try again" needs to work from either side of a failed attempt: before
  // ever connecting (just call connect again), or mid-call when the room
  // connected but the agent never joined (connect() alone would no-op since
  // isConnected is already true — the stuck room has to be torn down first).
  const handleRetryConnect = useCallback(async () => {
    if (call.isConnected || call.isConnecting) {
      await callActions.disconnect()
    }
    await handleConnect()
  }, [call.isConnected, call.isConnecting, callActions, handleConnect])

  return (
    <div className="flex h-full">
      <TestAgentPanel
        agentId={agentId}
        agentDisplayName={agent?.name ?? 'Agent'}
        voiceId={tts?.voice_id ?? ''}
        voiceProvider={tts?.name ?? ''}
        voiceSaving={voiceSaving}
        voiceSavingLabel={voiceUpdateLabel}
        voiceError={voiceError}
        onVoiceSelect={handleVoiceSelect}
        defaultVariables={assistant?.variables ?? {}}
        sessionVariables={sessionVariables}
        onVariablesChange={setSessionVariables}
        isConnected={call.isConnected}
        isConnecting={call.isConnecting || starting}
        connectionError={call.connectionError}
        connectionTime={call.connectionTime}
        agentState={call.agentState}
        transcripts={call.transcripts}
        isMuted={call.isMuted}
        onToggleMute={callActions.toggleMute}
        onConnect={hasPendingChanges ? handleUpdateAndStart : handleConnect}
        hasPendingChanges={hasPendingChanges}
        onDisconnect={handleDisconnect}
        onRetryConnect={handleRetryConnect}
        callDisabled={!agent || !backendAgentName || voiceSaving || !!voiceUpdateLabel}
        lastCallState={lastCallState}
        lastCallHref={lastCallHref}
        onRetryLastCall={retryLastCall}
      />

      <div style={{ minWidth: 320 }} className="flex flex-1 flex-col">
        {isPreview && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 px-4 py-1.5 text-xs text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Previewing Studio with a sample flow — create the agent through the MCP to see its real one.
            </span>
            <button
              onClick={onExitPreview}
              aria-label="Exit preview"
              className="rounded p-0.5 transition hover:bg-blue-100 dark:hover:bg-blue-500/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div className="shrink-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <InsightsStrip agentId={agentId} />
          </div>
          <div className="shrink-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <OutputVariablesPanel
              agentId={agentId}
              fieldExtractorPrompt={agent?.field_extractor_prompt}
              fieldExtractorVariables={agent?.field_extractor_variables}
              fieldExtractorEnabled={!!agent?.field_extractor}
              latestValues={dispositionValues}
              loading={dispositionsLoading}
              inProgress={call.isConnected || call.isConnecting || starting}
              canEdit={canEditDispositions}
              onSaved={refetchAgent}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StudioContent() {
  const { agent, isLoading } = useStudio()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'

  // Agents built through the Whispey MCP are tagged at creation; everything else
  // gets the "build it through the MCP" empty state.
  const createdViaMcp = agent?.configuration?.created_via === 'mcp'

  if (isLoading) {
    return (
      <div className="flex h-full gap-3 p-3">
        <Skeleton style={{ flexBasis: '65%', maxWidth: 820 }} className="h-full rounded-xl" />
        <Skeleton className="h-full flex-1 rounded-xl" />
      </div>
    )
  }

  if (!createdViaMcp && !isPreview) {
    return <StudioEmptyState onPreview={() => router.push(`${pathname}?preview=1`)} />
  }

  return <StudioWorkspace isPreview={!createdViaMcp && isPreview} onExitPreview={() => router.push(pathname)} />
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioContent />
    </Suspense>
  )
}
