// Fixed TalkToAssistant.tsx - Better layout and scrolling
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
import { useVoiceAgent } from '@/hooks/useVoiceAgent'
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
}

export default function TalkToAssistant({ 
  agentName, 
  isOpen, 
  onClose,
  agentStatus 
}: TalkToAssistantProps) {
  const [textMessage, setTextMessage] = useState('')
  const [isSendingText, setIsSendingText] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Use our custom voice agent hook
  const [voiceState, voiceActions] = useVoiceAgent({
    agentName,
    apiBaseUrl: process.env.NEXT_PUBLIC_PYPEAI_API_URL || ''
  })

  // Auto-scroll to bottom when new transcripts arrive
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [voiceState.transcripts])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getAgentStatusColor = () => {
    switch (agentStatus.status) {
      case 'running': return 'bg-green-500'
      case 'starting': return 'bg-yellow-500'
      case 'stopping': return 'bg-orange-500'
      case 'stopped': return 'bg-gray-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getAgentStateDisplay = () => {
    switch (voiceState.agentState) {
      case 'initializing': return '🔄 Initializing'
      case 'listening': return '👂 Listening'
      case 'thinking': return '🤔 Thinking'
      case 'speaking': return '🗣️ Speaking'
      default: return '⚫ Unknown'
    }
  }

  const handleSendTextMessage = async () => {
    if (!textMessage.trim() || isSendingText) return

    setIsSendingText(true)
    try {
      await voiceActions.sendTextMessage(textMessage)
      setTextMessage('')
    } catch (error) {
      console.error('Failed to send text message:', error)
    } finally {
      setIsSendingText(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendTextMessage()
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Compact Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Talk to Assistant</h3>
            <div className={`w-2 h-2 rounded-full ${getAgentStatusColor()}`}></div>
          </div>
          {/* <Button variant="ghost" size="sm" onClick={onClose}>×</Button> */}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{agentName}</p>
      </div>

      {/* Connection Error */}
      {voiceState.connectionError && (
        <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex-shrink-0">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
            <span className="text-sm font-medium">Connection Error</span>
          </div>
          <p className="text-xs text-red-700 dark:text-red-400 mt-1">{voiceState.connectionError}</p>
        </div>
      )}

      {/* Connection States - Compact */}
      {!voiceState.isConnected && !voiceState.isConnecting && (
        <div className="p-4 text-center flex-shrink-0">
          <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <PhoneIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Start voice conversation
          </p>
          <Button onClick={voiceActions.connect} className="w-full">
            Start Call
          </Button>
        </div>
      )}

      {voiceState.isConnecting && (
        <div className="p-4 text-center flex-shrink-0">
          <div className="w-12 h-12 mx-auto mb-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-yellow-600 dark:text-yellow-400 animate-spin" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Connecting to {agentName}...
          </p>
        </div>
      )}

      {/* Connected State - Much more compact */}
      {voiceState.isConnected && (
        <>
          {/* Compact Connection Status */}
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-700 dark:text-gray-300">Connected</span>
                <Badge variant="outline" className="text-xs">
                  {getAgentStateDisplay()}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{formatTime(voiceState.connectionTime)}</span>
                <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Settings className="w-3 h-3" />
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              </div>
            </div>

            {/* Collapsible Controls */}
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleContent className="mt-3 space-y-3">
                {/* Volume Control */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs">Volume</label>
                    <span className="text-xs text-gray-500">{voiceState.volume}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-3 h-3 text-gray-400" />
                    <Slider
                      value={[voiceState.volume]}
                      onValueChange={(value) => voiceActions.setVolume(value[0])}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Connection Details */}
                <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Audio:</span>
                    <span>{voiceState.isMuted ? 'Muted' : 'Active'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Room:</span>
                    <span className="truncate ml-2">{voiceState.webSession?.room_name || 'N/A'}</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Text Input - Compact */}
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Type a message..."
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 text-sm h-8"
                disabled={isSendingText}
              />
              <Button
                onClick={handleSendTextMessage}
                disabled={!textMessage.trim() || isSendingText}
                size="sm"
                className="h-8 w-8 p-0"
              >
                {isSendingText ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </Button>
            </div>
          </div>

          {/* MAIN TRANSCRIPT AREA - Takes most space */}
          <div className="flex-1 flex flex-col min-h-0 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Live Transcript ({voiceState.transcripts.length})
                </h4>
              </div>
              {voiceState.transcripts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={voiceActions.clearTranscripts}
                  className="h-6 text-xs"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            
            {/* Scrollable Transcript Container */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 rounded-lg overflow-hidden">
              <div className="h-full overflow-y-auto p-3">
                {voiceState.transcripts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                    <p>Start speaking to see transcripts appear here...</p>
                    <p className="text-xs mt-1 opacity-75">You can also type messages above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {voiceState.transcripts.map((transcript) => (
                      <div
                        key={transcript.id}
                        className={`flex gap-2 ${
                          transcript.speaker === 'user' ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <div className="flex items-start gap-2 max-w-[85%]">
                          {transcript.speaker === 'user' ? (
                            <User className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                          ) : (
                            <Bot className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          )}
                          <div
                            className={`rounded-lg px-3 py-2 text-sm ${
                              transcript.speaker === 'user'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200'
                            } ${!transcript.isFinal ? 'opacity-60 border-2 border-dashed border-gray-300' : ''}`}
                          >
                            <p className="break-words">{transcript.text}</p>
                            <div className="text-xs opacity-70 mt-1 flex items-center justify-between">
                              <span>{transcript.timestamp.toLocaleTimeString()}</span>
                              {!transcript.isFinal && (
                                <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-600 px-1 rounded">
                                  partial
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Auto-scroll anchor */}
                    <div ref={transcriptEndRef} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Compact Call Controls */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex justify-center gap-3">
              <Button
                variant={voiceState.isMuted ? "default" : "outline"}
                size="sm"
                onClick={voiceActions.toggleMute}
                className="flex items-center gap-2"
              >
                {voiceState.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {voiceState.isMuted ? 'Unmute' : 'Mute'}
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={voiceActions.disconnect}
                className="flex items-center gap-2"
              >
                <PhoneOff className="w-4 h-4" />
                End Call
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Compact Tips Section */}
      {!voiceState.isConnected && !voiceState.isConnecting && (
        <div className="p-4 mt-auto flex-shrink-0">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
              💡 Voice Testing Tips
            </h4>
            <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
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