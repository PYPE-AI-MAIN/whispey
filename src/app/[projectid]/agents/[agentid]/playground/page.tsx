'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useVoiceAgent } from '@/hooks/useVoiceAgent'
import { Loader2, Mic, MicOff, Volume2, VolumeX, PhoneOff, MessageSquare } from 'lucide-react'
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

// Predefined voices for playground
const PREDEFINED_VOICES = [
  { id: 'v4bksM2yzq2VeH1M3jt9', name: 'test_ashish', category: 'Personal' },
  { id: 'ulZgFXalzbrnPUGQGs0S', name: 'Vidya - Your Chatty Delhi Friend', category: 'Professional' },
  { id: '8l89UrPQsmYVJoJRfnAt', name: 'Vikram - Professional Customer Care Agent', category: 'Professional' },
  { id: 'MmQVkVZnQ0dUbfWzcW6f', name: 'Zara – Premium Customer Care Voice', category: 'Professional' },
  { id: 'PLFXYRTU74HpuNdj6oDl', name: 'Voice of God - Hindi Narration', category: 'Professional' },
  { id: 'eA8FmgNe2rjMWPK5PQQZ', name: 'Srikant | Male | Middle Aged | Accent Neutral | Indian', category: 'Professional' },
]

export default function PlaygroundPage() {
  const params = useParams()
  const agentId = params.agentid as string
  
  const [agentData, setAgentData] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null)

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
}

function SessionView({
  agentState,
  agentActions,
  agentName,
  agentId,
  selectedVoice,
  onVoiceSelect
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
    return (
      <section className="bg-background relative z-10 h-full w-full overflow-hidden flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Select a Voice</h2>
            <p className="text-sm text-muted-foreground">Choose a voice for your conversation</p>
          </div>

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
              disabled={!selectedVoice || updatingVoice}
              className="rounded-full"
            >
              {updatingVoice ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Updating Voice...
                </>
              ) : (
                'Start Conversation'
              )}
            </Button>
          </div>
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
