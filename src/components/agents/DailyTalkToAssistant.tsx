'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  PhoneIcon,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Loader2,
  MessageSquare,
  User,
  Bot,
  Trash2,
  Settings,
} from 'lucide-react'
import { useDailyVoiceAgent, type DailyTranscript } from '@/hooks/useDailyVoiceAgent'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface AgentStatus {
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
}

interface DailyTalkToAssistantProps {
  agentName: string
  isOpen: boolean
  onClose: () => void
  agentStatus: AgentStatus
  flashEndCall?: boolean
  onFlashEndCallDone?: () => void
  onSessionActiveChange?: (active: boolean) => void
  sessionEndpoint: string
  onCallEnded?: (transcripts: DailyTranscript[]) => void
}

export default function DailyTalkToAssistant({
  agentName,
  isOpen,
  onClose,
  agentStatus,
  flashEndCall = false,
  onFlashEndCallDone,
  onSessionActiveChange,
  sessionEndpoint,
  onCallEnded,
}: DailyTalkToAssistantProps) {
  const [showDetails, setShowDetails]               = useState(false)
  const [isEndCallHighlighted, setIsEndCallHighlighted] = useState(false)
  const [volume, setVolume]                         = useState(80)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const endCallRef       = useRef<HTMLButtonElement>(null)

  const [state, actions] = useDailyVoiceAgent({ agentName, sessionEndpoint })
  const sessionActive = state.isConnected || state.isConnecting

  useEffect(() => { onSessionActiveChange?.(sessionActive) }, [sessionActive, onSessionActiveChange])

  useEffect(() => {
    if (!flashEndCall) { setIsEndCallHighlighted(false); return }
    if (sessionActive) {
      setIsEndCallHighlighted(true)
      endCallRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const t = setTimeout(() => { setIsEndCallHighlighted(false); onFlashEndCallDone?.() }, 2000)
      return () => clearTimeout(t)
    } else {
      onFlashEndCallDone?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashEndCall])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.transcripts])

  const handleEndCall = React.useCallback(async () => {
    // Capture transcripts BEFORE disconnect clears them
    const finalTranscripts = [...state.transcripts]
    await actions.disconnect()
    if (finalTranscripts.length > 0) {
      onCallEnded?.(finalTranscripts)
    }
  }, [state.transcripts, actions, onCallEnded])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const statusColor = {
    running: 'bg-green-500', starting: 'bg-yellow-500',
    stopping: 'bg-orange-500', stopped: 'bg-gray-500', error: 'bg-red-500',
  }[agentStatus.status] ?? 'bg-gray-500'

  const agentStateLabel = {
    initializing: '🔄 Initializing',
    listening:    '👂 Listening',
    thinking:     '🤔 Thinking',
    speaking:     '🗣️ Speaking',
  }[state.agentState] ?? '⚫ Unknown'

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">

      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Talk to Assistant</h3>
            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{agentName}</p>
      </div>

      {/* ── Connection Error ── */}
      {state.connectionError && (
        <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex-shrink-0">
          <span className="text-sm font-medium text-red-800 dark:text-red-300">Connection Error</span>
          <p className="text-xs text-red-700 dark:text-red-400 mt-1">{state.connectionError}</p>
        </div>
      )}

      {/* ── Idle ── */}
      {!state.isConnected && !state.isConnecting && (
        <div className="p-4 text-center flex-shrink-0">
          <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <PhoneIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Start voice conversation</p>
          <Button onClick={actions.connect} className="w-full">Start Call</Button>
        </div>
      )}

      {/* ── Connecting ── */}
      {state.isConnecting && (
        <div className="p-4 text-center flex-shrink-0">
          <div className="w-12 h-12 mx-auto mb-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-yellow-600 dark:text-yellow-400 animate-spin" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Connecting to {agentName}...</p>
        </div>
      )}

      {/* ── Connected ── */}
      {state.isConnected && (
        <>
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-gray-700 dark:text-gray-300">Connected</span>
                <Badge variant="outline" className="text-xs">{agentStateLabel}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{formatTime(state.connectionTime)}</span>
                <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Settings className="w-3 h-3" />
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              </div>
            </div>

            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleContent className="mt-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs">Volume</label>
                    <span className="text-xs text-gray-500">{volume}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-3 h-3 text-gray-400" />
                    <Slider value={[volume]} onValueChange={v => setVolume(v[0])} max={100} step={1} className="flex-1" />
                  </div>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Audio:</span>
                    <span>{state.isMuted ? 'Muted' : 'Active'}</span>
                  </div>
                  {state.roomUrl && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Room:</span>
                      <span className="truncate ml-2">{state.roomUrl.split('/').pop()}</span>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Transcript area */}
          <div className="flex-1 flex flex-col min-h-0 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Live Transcript ({state.transcripts.length})
                </h4>
              </div>
              {state.transcripts.length > 0 && (
                <Button variant="ghost" size="sm" onClick={actions.clearTranscripts} className="h-6 text-xs">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 rounded-lg overflow-hidden">
              <div className="h-full overflow-y-auto p-3">
                {state.transcripts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                    <p>Start speaking to see transcripts...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {state.transcripts.map(t => (
                      <div key={t.id} className={`flex gap-2 ${t.speaker === 'user' ? 'justify-start' : 'justify-end'}`}>
                        <div className="flex items-start gap-2 max-w-[85%]">
                          {t.speaker === 'user'
                            ? <User className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                            : <Bot  className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          }
                          <div className={`rounded-lg px-3 py-2 text-sm ${
                            t.speaker === 'user'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200'
                          }`}>
                            <p className="break-words">{t.text}</p>
                            <div className="text-xs opacity-70 mt-1">
                              {t.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={transcriptEndRef} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            {isEndCallHighlighted && (
              <p className="text-center text-xs text-red-500 dark:text-red-400 mb-2 animate-pulse">
                End the call here before closing
              </p>
            )}
            <div className="flex justify-center gap-3">
              <Button
                variant={state.isMuted ? 'default' : 'outline'}
                size="sm"
                onClick={actions.toggleMute}
                className="flex items-center gap-2"
              >
                {state.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {state.isMuted ? 'Unmute' : 'Mute'}
              </Button>
              <Button
                ref={endCallRef}
                variant="destructive"
                size="sm"
                onClick={handleEndCall}
                className={[
                  'flex items-center gap-2 transition-all duration-150',
                  isEndCallHighlighted ? 'ring-2 ring-red-400 ring-offset-2 scale-105' : '',
                ].join(' ')}
              >
                <PhoneOff className="w-4 h-4" />
                End Call
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Tips — idle */}
      {!state.isConnected && !state.isConnecting && (
        <div className="p-4 mt-auto flex-shrink-0">
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <h4 className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-2">💡 Voice Testing Tips</h4>
            <ul className="text-xs text-orange-600 dark:text-orange-400 space-y-1">
              <li>• Test your system prompt and agent behavior</li>
              <li>• Verify STT, LLM, and TTS configurations</li>
              <li>• Check response timing and accuracy</li>
              <li>• Test tool calls and interruption handling</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
