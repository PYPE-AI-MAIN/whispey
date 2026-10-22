'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
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
  Send,
  Trash2,
  Settings
} from 'lucide-react'
import { useVoiceAgent, type AgentTestMode } from '@/hooks/useVoiceAgent'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface AgentStatus {
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
  pid?: number
  error?: string
}

interface TalkToAssistantProps {
  agentName: string
  isOpen: boolean
  onClose: () => void
  agentStatus: AgentStatus
  onAgentStatusChange?: () => void
  flashEndCall?: boolean
  onFlashEndCallDone?: () => void
  onSessionActiveChange?: (active: boolean) => void
  sessionEndpoint?: string  // override the session API (e.g. /api/pipecat/start-web-session)
  /** Workflow interpreter's live "wf-node" events (node_enter, function_call, ...) — workflow agents only. */
  onWorkflowEvent?: (event: Record<string, any>) => void
  deploymentTarget?: 'classic' | 'docker'  // which voice backend this agent lives on
  prepareSession?: () => Promise<boolean>  // see useVoiceAgent
}

const AGENT_STATUS_COLOR: Record<string, string> = {
  running: 'bg-green-500',
  starting: 'bg-yellow-500',
  stopping: 'bg-orange-500',
  stopped: 'bg-muted-foreground',
  error: 'bg-red-500',
}

const AGENT_STATE_LABEL: Record<string, string> = {
  initializing: 'Initializing',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function ModeButton({ active, disabled, onClick, icon, label }: Readonly<{ active: boolean; disabled: boolean; onClick: () => void; icon: React.ReactNode; label: string }>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  )
}

function runEndCallFlash({ flashEndCall, sessionActive, endCallRef, setIsEndCallHighlighted, onFlashEndCallDone }: {
  flashEndCall: boolean
  sessionActive: boolean
  endCallRef: React.RefObject<HTMLButtonElement | null>
  setIsEndCallHighlighted: (v: boolean) => void
  onFlashEndCallDone?: () => void
}): (() => void) | undefined {
  if (!flashEndCall) {
    setIsEndCallHighlighted(false) // always reset when parent resets
    return undefined
  }
  if (!sessionActive) {
    onFlashEndCallDone?.()
    return undefined
  }
  setIsEndCallHighlighted(true)
  endCallRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  const t = setTimeout(() => {
    setIsEndCallHighlighted(false)
    onFlashEndCallDone?.()
  }, 2000)
  return () => clearTimeout(t)
}

type VoiceHook = ReturnType<typeof useVoiceAgent>
type VoiceStateT = VoiceHook[0]
type VoiceActionsT = VoiceHook[1]
type TranscriptItem = VoiceStateT['transcripts'][number]

function TranscriptBubble({ transcript }: Readonly<{ transcript: TranscriptItem }>) {
  const fromUser = transcript.speaker === 'user'
  return (
    <div className={`flex gap-2 ${fromUser ? 'justify-start' : 'justify-end'}`}>
      <div className="flex items-start gap-2 max-w-[85%]">
        {fromUser
          ? <User className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
          : <Bot className="w-4 h-4 text-success mt-1 flex-shrink-0" />
        }
        <div className={`rounded-lg px-3 py-2 text-sm ${
          fromUser
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200'
            : 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200'
        } ${transcript.isFinal ? '' : 'opacity-60 border-2 border-dashed border-border'}`}>
          <p className="break-words">{transcript.text}</p>
          <div className="text-xs opacity-70 mt-1 flex items-center justify-between">
            <span>{transcript.timestamp.toLocaleTimeString()}</span>
            {!transcript.isFinal && (
              <span className="ml-2 text-xs bg-muted px-1 rounded">partial</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function IdlePanel({ mode, onStart }: Readonly<{ mode: AgentTestMode; onStart: () => void }>) {
  const isVoice = mode === 'voice'
  return (
    <div className="p-4 text-center flex-shrink-0">
      <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
        isVoice ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-emerald-50 dark:bg-emerald-900/30'
      }`}>
        {isVoice
          ? <PhoneIcon className="w-6 h-6 text-primary" />
          : <MessageSquare className="w-6 h-6 text-success" />
        }
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        {isVoice ? 'Start voice conversation' : 'Start text conversation — no audio'}
      </p>
      <Button onClick={onStart} className="w-full">
        {isVoice ? 'Start Call' : 'Start Chat'}
      </Button>
    </div>
  )
}

function VoiceDetails({ open, onOpenChange, voiceState, voiceActions }: Readonly<{
  open: boolean
  onOpenChange: (v: boolean) => void
  voiceState: VoiceStateT
  voiceActions: VoiceActionsT
}>) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleContent className="mt-3 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs">Volume</span>
            <span className="text-xs text-muted-foreground">{voiceState.volume}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className="w-3 h-3 text-muted-foreground" />
            <Slider value={[voiceState.volume]} onValueChange={v => voiceActions.setVolume(v[0])} max={100} step={1} className="flex-1" />
          </div>
        </div>
        <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Audio:</span>
            <span>{voiceState.isMuted ? 'Muted' : 'Active'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Room:</span>
            <span className="truncate ml-2">{voiceState.webSession?.room_name || voiceState.webSession?.room || 'N/A'}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function BottomControls({ mode, isEndCallHighlighted, voiceState, voiceActions, endCallRef }: Readonly<{
  mode: AgentTestMode
  isEndCallHighlighted: boolean
  voiceState: VoiceStateT
  voiceActions: VoiceActionsT
  endCallRef: React.RefObject<HTMLButtonElement | null>
}>) {
  return (
  <div className="p-3 border-t border-border flex-shrink-0">
    {isEndCallHighlighted && (
      <p className="text-center text-xs text-destructive mb-2 animate-pulse">
        End the {mode === 'voice' ? 'call' : 'session'} here before closing
      </p>
    )}
    {mode === 'voice' ? (
      <div className="flex justify-center gap-3">
        <Button
          variant={voiceState.isMuted ? 'default' : 'outline'}
          size="sm"
          onClick={voiceActions.toggleMute}
          className="flex items-center gap-2"
        >
          {voiceState.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {voiceState.isMuted ? 'Unmute' : 'Mute'}
        </Button>
        <Button
          ref={endCallRef}
          variant="destructive"
          size="sm"
          onClick={voiceActions.disconnect}
          className={[
            'flex items-center gap-2 transition-all duration-150',
            isEndCallHighlighted ? 'ring-2 ring-red-400 ring-offset-2 scale-105' : '',
          ].join(' ')}
        >
          <PhoneOff className="w-4 h-4" />
          End Call
        </Button>
      </div>
    ) : (
      <div className="flex justify-center">
        <Button
          ref={endCallRef}
          variant="destructive"
          size="sm"
          onClick={voiceActions.disconnect}
          className={[
            'flex items-center gap-2 transition-all duration-150',
            isEndCallHighlighted ? 'ring-2 ring-red-400 ring-offset-2 scale-105' : '',
          ].join(' ')}
        >
          <PhoneOff className="w-4 h-4" />
          End Session
        </Button>
      </div>
    )}
  </div>
  )
}

export default function TalkToAssistant({
  agentName,
  isOpen,
  onClose,
  agentStatus,
  onAgentStatusChange,
  flashEndCall = false,
  onFlashEndCallDone,
  onSessionActiveChange,
  sessionEndpoint,
  onWorkflowEvent,
  deploymentTarget = 'classic',
  prepareSession,
}: Readonly<TalkToAssistantProps>) {
  const [mode, setMode]                   = useState<AgentTestMode>('voice')
  const [textMessage, setTextMessage]     = useState('')
  const [isSendingText, setIsSendingText] = useState(false)
  const [showDetails, setShowDetails]     = useState(false)
  const [isEndCallHighlighted, setIsEndCallHighlighted] = useState(false)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const endCallRef       = useRef<HTMLButtonElement>(null)
  const inputRef         = useRef<HTMLInputElement>(null)

  const [voiceState, voiceActions] = useVoiceAgent({ agentName, mode, sessionEndpoint, onWorkflowEvent, deploymentTarget, prepareSession })

  const sessionActive = voiceState.isConnected || voiceState.isConnecting

  useEffect(() => {
    onSessionActiveChange?.(sessionActive)
  }, [sessionActive, onSessionActiveChange])

  // Flash end call — only trigger when session is actually active.
  useEffect(() => runEndCallFlash({ flashEndCall, sessionActive, endCallRef, setIsEndCallHighlighted, onFlashEndCallDone }), [flashEndCall])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [voiceState.transcripts])

  useEffect(() => {
    if (voiceState.isConnected) onAgentStatusChange?.()
  }, [voiceState.isConnected, onAgentStatusChange])

  const handleModeSwitch = async (next: AgentTestMode) => {
    if (next === mode || sessionActive) return
    setMode(next)
  }

  const getAgentStatusColor = () => AGENT_STATUS_COLOR[agentStatus.status] ?? 'bg-muted-foreground'
  const getAgentStateDisplay = () => AGENT_STATE_LABEL[voiceState.agentState] ?? 'Unknown'

  const handleSendTextMessage = async () => {
    if (!textMessage.trim() || isSendingText) return
    setIsSendingText(true)
    try {
      await voiceActions.sendChatMessage(textMessage)
      setTextMessage('')
      // ← no focus() call here, input retains focus naturally
    } catch (error) {
      console.error('Failed to send chat message:', error)
    } finally {
      setIsSendingText(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault()
      handleSendTextMessage() 
    }
  }

  return (
    <div className="h-full flex flex-col bg-card">

      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">Talk to Assistant</h3>
            <div className={`w-2 h-2 rounded-full ${getAgentStatusColor()}`} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">{agentName}</p>

        <div className={`flex items-center bg-muted rounded-lg p-0.5 gap-0.5 ${sessionActive ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <ModeButton active={mode === 'voice'} disabled={sessionActive} onClick={() => handleModeSwitch('voice')} icon={<Mic className="w-3.5 h-3.5" />} label="Voice" />
          <ModeButton active={mode === 'chat'} disabled={sessionActive} onClick={() => handleModeSwitch('chat')} icon={<MessageSquare className="w-3.5 h-3.5" />} label="Chat" />
        </div>
      </div>

      {/* ── Connection Error ── */}
      {voiceState.connectionError && (
        <div className="mx-4 mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex-shrink-0">
          <span className="text-sm font-medium text-destructive">Connection Error</span>
          <p className="text-xs text-destructive mt-1">{voiceState.connectionError}</p>
        </div>
      )}

      {/* ── Idle ── */}
      {!voiceState.isConnected && !voiceState.isConnecting && (
        <IdlePanel mode={mode} onStart={() => voiceActions.connect()} />
      )}

      {/* ── Connecting ── */}
      {voiceState.isConnecting && (
        <div className="p-4 text-center flex-shrink-0">
          <div className="w-12 h-12 mx-auto mb-3 bg-warning/10 rounded-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-warning animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Connecting to {agentName}...</p>
        </div>
      )}

      {/* ── Connected ── */}
      {voiceState.isConnected && (
        <>
          <div className="px-4 py-2 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-foreground">Connected</span>
                <Badge variant="outline" className="text-xs">{getAgentStateDisplay()}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatTime(voiceState.connectionTime)}</span>
                {mode === 'voice' && (
                  <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <Settings className="w-3 h-3" />
                      </Button>
                    </CollapsibleTrigger>
                  </Collapsible>
                )}
              </div>
            </div>

            {mode === 'voice' && (
              <VoiceDetails open={showDetails} onOpenChange={setShowDetails} voiceState={voiceState} voiceActions={voiceActions} />
            )}
          </div>

          {/* Chat input — chat mode only */}
          {mode === 'chat' && (
            <div className="px-4 py-2 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  data-talk-input
                  placeholder="Type a message..."
                  value={textMessage}
                  onChange={e => setTextMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 text-sm h-8"
                  disabled={isSendingText}
                  autoFocus
                />
                <Button
                  onClick={handleSendTextMessage}
                  disabled={!textMessage.trim() || isSendingText}
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  {isSendingText ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          )}

          {/* Transcript area */}
          <div className="flex-1 flex flex-col min-h-0 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-medium text-foreground">
                  {mode === 'voice' ? 'Live Transcript' : 'Conversation'} ({voiceState.transcripts.length})
                </h4>
              </div>
              {voiceState.transcripts.length > 0 && (
                <Button variant="ghost" size="sm" onClick={voiceActions.clearTranscripts} className="h-6 text-xs">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            <div className="flex-1 bg-muted/50 rounded-lg overflow-hidden">
              <div className="h-full overflow-y-auto p-3">
                {voiceState.transcripts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                    <p>{mode === 'voice' ? 'Start speaking to see transcripts...' : 'Type a message above to begin...'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {voiceState.transcripts.map(transcript => (
                      <TranscriptBubble key={transcript.id} transcript={transcript} />
                    ))}
                    <div ref={transcriptEndRef} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom controls */}
          <BottomControls mode={mode} isEndCallHighlighted={isEndCallHighlighted} voiceState={voiceState} voiceActions={voiceActions} endCallRef={endCallRef} />
        </>
      )}

      {/* Tips — voice idle only */}
      {!voiceState.isConnected && !voiceState.isConnecting && mode === 'voice' && (
        <div className="p-4 mt-auto flex-shrink-0">
          <div className="p-3 bg-primary/10 rounded-lg">
            <h4 className="text-xs font-medium text-primary mb-2">Voice Testing Tips</h4>
            <ul className="text-xs text-primary space-y-1">
              <li>• Test your system prompt and personality</li>
              <li>• Verify STT, LLM, and TTS configurations</li>
              <li>• Check response timing and accuracy</li>
              <li>• Test interruption handling</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}