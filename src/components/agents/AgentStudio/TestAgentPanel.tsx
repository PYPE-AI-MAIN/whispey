'use client'

import { useState } from 'react'
import { ChevronDown, Loader2, AlertCircle, PhoneIcon, PhoneOff, Volume2, Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { BarVisualizer } from '@/components/playground/BarVisualizer'
import { ConversationView } from '@/components/playground/ConversationView'
import type { Transcript } from '@/hooks/useVoiceAgent'
import MinimalVoicePicker from './MinimalVoicePicker'
import SessionVariablesPanel from './SessionVariablesPanel'

const BAR_HEIGHTS = [18, 34, 46, 28, 40, 22, 32]

function IdleWaveform() {
  return (
    <div className="flex h-12 items-end gap-1">
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-gradient-to-t from-violet-500/70 to-fuchsia-400/70"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  )
}

type AgentCallState = 'initializing' | 'listening' | 'thinking' | 'speaking'

interface TestAgentPanelProps {
  agentId: string
  agentDisplayName: string
  voiceId: string
  voiceProvider: string
  voiceSaving: boolean
  voiceError: string | null
  onVoiceSelect: (voiceId: string, provider: string, model?: string) => void
  defaultVariables: Record<string, string>
  onVariablesChange: (vars: Record<string, string>) => void
  // Live call (LiveKit) state — lifted up so it survives tab switches within the panel.
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  agentState: AgentCallState
  transcripts: Transcript[]
  isMuted: boolean
  onToggleMute: () => void
  onConnect: () => void
  onDisconnect: () => void
  callDisabled?: boolean
}

type TestTab = 'voice' | 'phone' | 'chat'

export default function TestAgentPanel({
  agentId,
  agentDisplayName,
  voiceId,
  voiceProvider,
  voiceSaving,
  voiceError,
  onVoiceSelect,
  defaultVariables,
  onVariablesChange,
  isConnected,
  isConnecting,
  connectionError,
  agentState,
  transcripts,
  isMuted,
  onToggleMute,
  onConnect,
  onDisconnect,
  callDisabled,
}: TestAgentPanelProps) {
  const [tab, setTab] = useState<TestTab>('voice')
  const [setupOpen, setSetupOpen] = useState(true)
  const [phoneNumber, setPhoneNumber] = useState('')

  const inCall = isConnected || isConnecting

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border-l border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 px-5 py-3.5 dark:border-gray-800">
        <h2 className="mb-3 text-[13px] font-medium text-gray-900 dark:text-gray-100">Test Agent</h2>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TestTab)}>
          <TabsList className="h-8 w-full">
            <TabsTrigger value="voice" className="flex-1 text-[12px]">Voice</TabsTrigger>
            <TabsTrigger value="phone" className="flex-1 text-[12px]">Phone</TabsTrigger>
            <TabsTrigger value="chat" className="flex-1 text-[12px]">Chat</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'voice' ? (
        inCall ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col items-center gap-2 px-6 py-4">
              <BarVisualizer state={agentState} />
              <p className="text-[11px] text-gray-500">
                {isConnecting ? 'Connecting…' : agentState}
              </p>
              {connectionError && (
                <p className="flex items-center gap-1.5 text-[11px] text-rose-600">
                  <AlertCircle className="h-3 w-3" /> {connectionError}
                </p>
              )}
            </div>
            <ConversationView
              transcripts={transcripts}
              agentName={agentDisplayName}
              agentState={agentState}
              className="min-h-0 flex-1 overflow-y-auto px-4"
            />
            <div className="flex justify-center border-t border-gray-200 px-5 py-3 dark:border-gray-800">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={onToggleMute}>
                {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
            <IdleWaveform />
            <p className="text-center text-[12px] text-gray-500">Start a call to test the agent</p>
            {connectionError && (
              <p className="flex items-center gap-1.5 text-center text-[11px] text-rose-600">
                <AlertCircle className="h-3 w-3" /> {connectionError}
              </p>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <IdleWaveform />
          <p className="text-center text-[12px] text-gray-500">
            {tab === 'phone' ? 'Call a real number to test the agent' : 'Send a message to test the agent'}
          </p>
          {tab === 'phone' && (
            <div className="w-full max-w-[240px]">
              <label className="mb-1 block text-center text-[10px] text-gray-500">Call to</label>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 555 000 1234"
                className="w-full rounded-md border border-gray-200 bg-transparent px-2.5 py-1.5 text-center text-[12px] text-gray-800 outline-none focus:border-gray-400 dark:border-gray-800 dark:text-gray-200"
              />
            </div>
          )}
          <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 dark:border-gray-800">
            coming soon
          </span>
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-800">
        <Collapsible open={setupOpen} onOpenChange={setSetupOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between px-5 py-3 text-[12px] font-medium text-gray-700 dark:text-gray-300">
              <span className="flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-gray-400" /> Setup
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${setupOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="max-h-[280px] space-y-4 overflow-y-auto px-5 pb-3">
            <div className="space-y-2">
              <MinimalVoicePicker
                selectedVoiceId={voiceId}
                selectedProvider={voiceProvider}
                onSelect={onVoiceSelect}
                disabled={voiceSaving}
              />
              {voiceSaving && (
                <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Applying voice change…
                </p>
              )}
              {voiceError && (
                <p className="flex items-center gap-1.5 text-[11px] text-rose-600">
                  <AlertCircle className="h-3 w-3" /> {voiceError}
                </p>
              )}
            </div>

            <SessionVariablesPanel
              agentId={agentId}
              defaultVariables={defaultVariables}
              onChange={onVariablesChange}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="border-t border-gray-200 p-5 dark:border-gray-800">
        {tab === 'voice' ? (
          inCall ? (
            <Button
              className="h-10 w-full gap-2 bg-rose-600 text-[13px] text-white hover:bg-rose-700"
              onClick={onDisconnect}
            >
              <PhoneOff className="h-3.5 w-3.5" />
              End Call
            </Button>
          ) : (
            <Button
              className="h-10 w-full gap-2 bg-gray-900 text-[13px] text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
              onClick={onConnect}
              disabled={callDisabled}
            >
              <PhoneIcon className="h-3.5 w-3.5" />
              Start Call
            </Button>
          )
        ) : (
          <Button
            className="h-10 w-full gap-2 bg-gray-900 text-[13px] text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
            disabled
          >
            <PhoneIcon className="h-3.5 w-3.5" />
            {tab === 'phone' ? 'Place Call' : 'Start Chat'}
          </Button>
        )}
      </div>
    </div>
  )
}
