'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useVoiceAgent } from '@/hooks/useVoiceAgent'
import { Loader2, Mic, MicOff, Volume2, VolumeX, PhoneOff, MessageSquare, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ConversationView } from '@/components/playground/ConversationView'
import { BarVisualizer } from '@/components/playground/BarVisualizer'
import { cn } from '@/lib/utils'

interface AgentData {
  id: string
  name: string
  agent_type: string
  displayName: string
  connectionName: string
}

interface AgentStatus {
  is_active: boolean
  worker_running: boolean
  worker_pid?: number
  inbound_ready?: boolean
}

// Predefined voices for playground
const PREDEFINED_VOICES = [
  // Female voices
  { id: 'H8bdWZHK2OgZwTN7ponr', name: 'Saavi', category: 'Female' },
  { id: 'pGYsZruQzo8cpdFVZyJc', name: 'Smiriti', category: 'Female' },
  { id: 'UrB5rVw5j9MDZWDZJtOJ', name: 'Reyanshi', category: 'Female' },
  { id: 'SZfY4K69FwXus87eayHK', name: 'Nikita', category: 'Female' },
  { id: 'BYoWSRudHCnfmjFrtcSW', name: 'Shivi', category: 'Female' },
  { id: '2zRM7PkgwBPiau2jvVXc', name: 'Monika', category: 'Female' },
  { id: 'MmQVkVZnQ0dUbfWzcW6f', name: 'Zara', category: 'Female' },
  { id: 'OUBnvvuqEKdDWtapoJFn', name: 'Tia Mirza', category: 'Female' },
  { id: 'ZeK6O9RfGNGj0cJT2HoJ', name: 'Shanaya', category: 'Female' },
  { id: 'h3vxoHEil3T93VGdTQQu', name: 'Avira', category: 'Female' },
  { id: 'lx9HCNXE1EkLR0EPKlLY', name: 'Roohi', category: 'Female' },
  { id: 'OwA6IqdLakQOd19pSLOn', name: 'Mahi', category: 'Female' },
  { id: 'S3F8rLt9v7twQC170pA5', name: 'Tarini', category: 'Female' },
  // Male voices
  { id: '6MoEUz34rbRrmmyxgRm4', name: 'Manav', category: 'Male' },
  { id: 'XopCoWNooN3d7LfWZyX5', name: 'Krishna', category: 'Male' },
  { id: 'XvGB4n0TZ3xj7tfNUc6i', name: 'Ishaan', category: 'Male' },
  { id: 'pzxut4zZz4GImZNlqQ3H', name: 'Raju', category: 'Male' },
  { id: 'CcvwadKSTkja3dbjRwC5', name: 'Rohit', category: 'Male' },
]

export default function PlaygroundPage() {
  const params = useParams()
  const agentId = params.agentid as string
  
  const [agentData, setAgentData] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null)
  const [currentConfigVoice, setCurrentConfigVoice] = useState<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(`/api/agents/${agentId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch agent')
        }
        
        const data = await response.json()
        
        if (!data.name || !data.name.trim()) {
          throw new Error('Agent name is required')
        }
        
        const sanitizedAgentId = agentId.replace(/-/g, '_')
        const agentNameWithId = `${data.name.trim()}_${sanitizedAgentId}`
        
        setAgentData({
          ...data,
          displayName: data.name.trim(),
          connectionName: agentNameWithId
        })

        // Fetch current voice from agent config
        try {
          const configResponse = await fetch(`/api/agent-config/${encodeURIComponent(agentNameWithId)}`)
          
          if (configResponse.ok) {
            const configData = await configResponse.json()
            const voiceId = configData?.agent?.assistant?.[0]?.tts?.voice_id
            if (voiceId) {
              setCurrentConfigVoice(voiceId)
              // Auto-select if it matches a predefined voice
              if (PREDEFINED_VOICES.some(v => v.id === voiceId)) {
                setSelectedVoice(voiceId)
              }
            }
          }
        } catch (err) {
          console.warn('Could not fetch agent config:', err)
        }

        // Check agent running status
        try {
          setCheckingStatus(true)
          const statusResponse = await fetch(`/api/agents/status/${encodeURIComponent(agentNameWithId)}`)
          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            setAgentStatus(statusData)
          }
        } catch (err) {
          console.warn('Could not check agent status:', err)
        } finally {
          setCheckingStatus(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agent')
      } finally {
        setLoading(false)
      }
    }

    if (agentId) {
      fetchAgent()
    }
  }, [agentId])

  const [agentState, agentActions] = useVoiceAgent({
    agentName: agentData?.connectionName || ''
  })

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-foreground" />
          <p className="text-muted-foreground">Loading agent...</p>
        </div>
      </div>
    )
  }

  if (error || !agentData) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="text-destructive text-xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Error</h1>
          <p className="text-muted-foreground mb-6">{error || 'Agent not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      <SessionView
        agentState={agentState}
        agentActions={agentActions}
        agentName={agentData.displayName}
        agentId={agentId}
        selectedVoice={selectedVoice}
        onVoiceSelect={setSelectedVoice}
        currentConfigVoice={currentConfigVoice}
        agentStatus={agentStatus}
        checkingStatus={checkingStatus}
      />
    </div>
  )
}

interface SessionViewProps {
  agentState: any
  agentActions: any
  agentName: string
  agentId: string
  selectedVoice: string | null
  onVoiceSelect: (voiceId: string | null) => void
  currentConfigVoice: string | null
  agentStatus: AgentStatus | null
  checkingStatus: boolean
}

function SessionView({
  agentState,
  agentActions,
  agentName,
  agentId,
  selectedVoice,
  onVoiceSelect,
  currentConfigVoice,
  agentStatus,
  checkingStatus
}: SessionViewProps) {
  const {
    isConnected,
    isConnecting,
    connectionError,
    transcripts,
    agentState: state,
    isMuted,
    volume,
    room
  } = agentState

  const {
    connect,
    disconnect,
    toggleMute,
    setVolume
  } = agentActions

  const [updatingVoice, setUpdatingVoice] = useState(false)
  const [chatOpen, setChatOpen] = useState(true) // Auto-open chat
  const [showSettings, setShowSettings] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const handleStartWithVoice = async () => {
    if (!selectedVoice) return

    try {
      setUpdatingVoice(true)
      
      // Only update voice if it's different from current config
      if (selectedVoice !== currentConfigVoice) {
        const updateResponse = await fetch(`/api/agents/${agentId}/update-voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceId: selectedVoice,
            voiceName: PREDEFINED_VOICES.find(v => v.id === selectedVoice)?.name
          })
        })

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json()
          throw new Error(errorData.error || 'Failed to update voice')
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      await connect()
    } catch (error) {
      console.error('Error updating voice and starting:', error)
      alert(error instanceof Error ? error.message : 'Failed to start with selected voice')
    } finally {
      setUpdatingVoice(false)
    }
  }

  // Auto-scroll chat when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current && transcripts.length > 0) {
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
        }
      })
    }
  }, [transcripts.length, transcripts])

  // Voice selection UI
  if (!isConnected && !isConnecting) {
    const isAgentRunning = agentStatus?.is_active && agentStatus?.worker_running

    return (
      <section className="bg-background relative z-10 h-full w-full overflow-hidden flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Select a Voice</h2>
            <p className="text-sm text-muted-foreground">Choose a voice for your conversation</p>
          </div>

          {/* Agent Running Status */}
          {!checkingStatus && agentStatus && (
            <div className={cn(
              "rounded-lg border-2 p-4 flex items-center gap-3",
              isAgentRunning 
                ? "border-green-500/50 bg-green-500/10" 
                : "border-red-500/50 bg-red-500/10"
            )}>
              <AlertCircle className={cn(
                "h-5 w-5 flex-shrink-0",
                isAgentRunning ? "text-green-500" : "text-red-500"
              )} />
              <div className="flex-1">
                <div className={cn(
                  "text-sm font-medium",
                  isAgentRunning ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                )}>
                  {isAgentRunning ? 'Agent is Running' : 'Agent is Not Running'}
                </div>
                {!isAgentRunning && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Please start the agent before testing in the playground
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PREDEFINED_VOICES.map((voice) => (
              <button
                key={voice.id}
                onClick={() => onVoiceSelect(selectedVoice === voice.id ? null : voice.id)}
                className={cn(
                  'p-4 rounded-lg border-2 transition-all text-left',
                  selectedVoice === voice.id
                    ? 'border-primary bg-primary/20'
                    : 'border-input bg-background hover:border-input/80'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-foreground text-sm">{voice.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{voice.category}</div>
                  </div>
                  {selectedVoice === voice.id && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-center pt-4">
            <Button
              onClick={handleStartWithVoice}
              size="lg"
              disabled={!selectedVoice || updatingVoice || !isAgentRunning}
              className="rounded-full"
            >
              {updatingVoice ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {selectedVoice !== currentConfigVoice ? 'Updating Voice...' : 'Starting...'}
                </>
              ) : (
                'Start Conversation'
              )}
            </Button>
          </div>
          {!isAgentRunning && (
            <p className="text-xs text-center text-muted-foreground">
              Agent must be running to start a conversation
            </p>
          )}
        </div>
      </section>
    )
  }

  if (isConnecting) {
    return (
      <section className="bg-background relative z-10 h-full w-full overflow-hidden flex items-center justify-center">
        <div className="flex items-center gap-3 text-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Connecting...</span>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-background relative z-10 h-full w-full overflow-hidden flex flex-col">
      {/* Wave at Top - Always visible when connected */}
      {isConnected && (
        <div className="flex-shrink-0 px-4 pt-6 md:px-6 md:pt-8 z-20">
          <div className="mx-auto max-w-4xl">
            <div className="bg-background h-[90px] rounded-md drop-shadow-lg/10 flex items-center justify-center">
              <BarVisualizer
                state={state === 'initializing' ? 'listening' : state}
                barCount={5}
                className="flex h-full items-center justify-center gap-1"
              />
            </div>
          </div>
        </div>
      )}

      {/* Conversation Area - Middle (40-50vh) - Centered Vertically */}
      {isConnected && (
        <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
          <div 
            className="w-full mx-auto max-w-4xl" 
            style={{ height: '45vh', minHeight: '40vh', maxHeight: '50vh' }}
          >
            <div
              ref={scrollAreaRef}
              className="h-full overflow-y-auto px-4 md:px-6 py-4"
            >
              <ConversationView
                hidden={false}
                transcripts={transcripts}
                agentName={agentName}
                agentState={state}
                className="space-y-3"
              />
            </div>
          </div>
        </div>
      )}

      {/* Spacer to push controls down */}
      {isConnected && <div className="flex-shrink-0" style={{ height: '120px' }} />}

      {/* Bottom Control Bar - Centered */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center">
        <div className="bg-background relative max-w-2xl w-full px-3 pb-3 md:px-12 md:pb-12">
          {/* Fade gradient at bottom */}
          <div className="absolute inset-x-0 top-0 h-4 -translate-y-full bg-gradient-to-t from-background to-transparent pointer-events-none" />
          
          <div className={cn(
            'bg-background border-input/50 dark:border-muted flex flex-col rounded-[31px] border p-3 drop-shadow-md/3'
          )}>
            {/* Settings Panel */}
            {showSettings && (
              <div className="mb-3 pb-3 border-b border-input/50">
                <div className="flex items-center gap-4" dir="ltr">
                  <VolumeX className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <Slider
                    value={[volume]}
                    onValueChange={(value) => setVolume(value[0])}
                    max={100}
                    min={0}
                    step={1}
                    className="flex-1"
                  />
                  <Volume2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground text-sm w-12 text-right flex-shrink-0" dir="ltr">{volume}%</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2">
              {/* Microphone Toggle */}
              <Button
                size="icon"
                variant={isMuted ? "destructive" : "secondary"}
                onClick={toggleMute}
                className="rounded-full"
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>

              {/* Chat Toggle */}
              <Button
                size="icon"
                variant={chatOpen ? "default" : "secondary"}
                onClick={() => setChatOpen(!chatOpen)}
                className="rounded-full"
              >
                <MessageSquare className="h-5 w-5" />
              </Button>

              {/* Disconnect Button */}
              <Button
                variant="destructive"
                onClick={disconnect}
                className="font-mono rounded-full"
              >
                <PhoneOff className="h-5 w-5 mr-2" />
                <span className="hidden md:inline">END CALL</span>
                <span className="inline md:hidden">END</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
