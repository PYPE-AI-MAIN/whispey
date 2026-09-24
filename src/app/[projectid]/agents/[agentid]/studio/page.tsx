'use client'

import { Suspense, useCallback, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Eye, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useVoiceAgent } from '@/hooks/useVoiceAgent'
import { saveAndDeployAgent, useUpdateProgressLabel } from '@/hooks/useAgentConfig'
import ConversationFlow, { SAMPLE_FLOW } from '@/components/agents/AgentStudio/ConversationFlow'
import InsightsStrip from '@/components/agents/AgentStudio/InsightsStrip'
import StudioEmptyState from '@/components/agents/AgentStudio/StudioEmptyState'
import TestAgentPanel from '@/components/agents/AgentStudio/TestAgentPanel'
import { useStudio } from './_context'

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
  const { agent, agentId, backendAgentName } = useStudio()

  const { data: liveAgentConfig, refetch: refetchConfig } = useCurrentAssistantConfig(backendAgentName)
  const assistant = liveAgentConfig?.assistant?.[0] ?? null
  const tts = assistant?.tts ?? null

  const [leftTab, setLeftTab] = useState<'flow' | 'insights'>('flow')
  const [voiceSaving, setVoiceSaving] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [sessionVariables, setSessionVariables] = useState<Record<string, string>>({})
  // Same live stage label the real config page shows while it deploys
  // ("Validating config…" → "Stopping current worker…" → … → "Verifying…") —
  // no guessed duration, just what the backend is actually doing right now.
  const voiceUpdateLabel = useUpdateProgressLabel(backendAgentName, voiceSaving)

  // LiveKit test call — same connection name the playground and config pages use.
  const [call, callActions] = useVoiceAgent({ agentName: backendAgentName, mode: 'voice' })

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
        const { voice_settings: _oldVoiceSettings, ...ttsBase } = currentAssistant.tts ?? {}
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
        setVoiceError(err?.message ?? 'Failed to update voice')
      } finally {
        setVoiceSaving(false)
      }
    },
    [backendAgentName, liveAgentConfig, refetchConfig]
  )

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
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

        {/* One thing at a time on the left — Flow and Insights used to be
            stacked and always both visible, which was a lot to take in at
            once. A tab switcher (matching the Voice/Phone/Chat pattern on
            the right) keeps only one on screen. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as typeof leftTab)} className="shrink-0">
            <TabsList className="h-8">
              <TabsTrigger value="flow" className="text-[12px]">Conversation flow</TabsTrigger>
              <TabsTrigger value="insights" className="text-[12px]">Insights</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="min-h-0 flex-1">
            {leftTab === 'flow' ? (
              <ConversationFlow stages={SAMPLE_FLOW} isSample />
            ) : (
              <div className="h-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <InsightsStrip />
              </div>
            )}
          </div>
        </div>
      </div>

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
        isConnecting={call.isConnecting}
        connectionError={call.connectionError}
        connectionTime={call.connectionTime}
        agentState={call.agentState}
        transcripts={call.transcripts}
        isMuted={call.isMuted}
        onToggleMute={callActions.toggleMute}
        onConnect={callActions.connect}
        onDisconnect={callActions.disconnect}
        callDisabled={!agent || !backendAgentName || voiceSaving}
      />
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
        <Skeleton className="h-full flex-1 rounded-xl" />
        <Skeleton className="h-full w-[400px] rounded-xl" />
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
