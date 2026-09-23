'use client'

import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVoiceAgent } from '@/hooks/useVoiceAgent'
import DialogueFlowPreview from '@/components/agents/AgentStudio/DialogueFlowPreview'
import InsightsPanel from '@/components/agents/AgentStudio/InsightsPanel'
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

export default function StudioPage() {
  const { agent, agentId, backendAgentName } = useStudio()

  const { data: liveAgentConfig, refetch: refetchConfig } = useCurrentAssistantConfig(backendAgentName)
  const assistant = liveAgentConfig?.assistant?.[0] ?? null
  const tts = assistant?.tts ?? null

  const [voiceSaving, setVoiceSaving] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [sessionVariables, setSessionVariables] = useState<Record<string, string>>({})

  // LiveKit test call — same connection name ("<agent.name>_<uuid_with_underscores>")
  // the real playground and every other agent-config surface use.
  const [callState, callActions] = useVoiceAgent({
    agentName: backendAgentName,
    mode: 'voice',
  })

  const handleVoiceSelect = useCallback(
    async (voiceId: string, provider: string, model?: string) => {
      if (!backendAgentName || !liveAgentConfig?.assistant?.[0]) return
      setVoiceSaving(true)
      setVoiceError(null)
      try {
        const currentAssistant = liveAgentConfig.assistant[0]
        const updatedAssistant = {
          ...currentAssistant,
          tts: {
            ...currentAssistant.tts,
            name: provider,
            voice_id: voiceId,
            ...(model ? { model } : {}),
          },
        }
        const res = await fetch('/api/agents/save-and-deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent: { ...liveAgentConfig, assistant: [updatedAssistant] },
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.message || 'Failed to update voice')
        }
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
      {/* Left: turns (scrollable) on top, insights strip below */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-[7] overflow-y-auto border-r border-gray-200 px-8 py-6 dark:border-gray-800">
          <div className="mx-auto max-w-2xl">
            <DialogueFlowPreview />
          </div>
        </div>
        <div className="flex-[3] overflow-y-auto border-r border-t border-gray-200 dark:border-gray-800">
          <InsightsPanel />
        </div>
      </div>

      {/* Right: full-height test panel */}
      <TestAgentPanel
        agentId={agentId}
        agentDisplayName={agent?.name ?? 'Agent'}
        voiceId={tts?.voice_id ?? ''}
        voiceProvider={tts?.name ?? ''}
        voiceSaving={voiceSaving}
        voiceError={voiceError}
        onVoiceSelect={handleVoiceSelect}
        defaultVariables={assistant?.variables ?? {}}
        onVariablesChange={setSessionVariables}
        isConnected={callState.isConnected}
        isConnecting={callState.isConnecting}
        connectionError={callState.connectionError}
        agentState={callState.agentState}
        transcripts={callState.transcripts}
        isMuted={callState.isMuted}
        onToggleMute={callActions.toggleMute}
        onConnect={callActions.connect}
        onDisconnect={callActions.disconnect}
        callDisabled={!agent || !backendAgentName}
      />
    </div>
  )
}
