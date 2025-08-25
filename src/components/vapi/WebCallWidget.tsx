import React, { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Loader2, 
  Volume2, 
  VolumeX, 
  User, 
  Bot, 
  MessageSquare 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWebCall } from '@/hooks/useWebCall'

interface WebCallWidgetProps {
  agentId: string
  assistantId: string
  agentName: string
  publicApiKey: string
  onCallStart?: (callId: string) => void
  onCallEnd?: (callId: string, reason: string) => void
  onTranscript?: (transcript: string, role: 'user' | 'assistant') => void
  className?: string
  hideStartButton?: boolean
}

export const WebCallWidget: React.FC<WebCallWidgetProps> = ({
  agentId,
  assistantId,
  agentName,
  publicApiKey,
  onCallStart,
  onCallEnd,
  onTranscript,
  className,
  hideStartButton = false
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    isCallActive,
    isMuted,
    callId,
    callStatus,
    error,
    messages,
    currentPartialTranscript,
    startCall,
    endCall,
    toggleMute,
    clearError
  } = useWebCall({
    assistantId,
    publicApiKey,
    onCallStart,
    onCallEnd,
    onTranscript,
    onError: (error) => console.error('Web call error:', error)
  })

  const isLoading = callStatus === 'connecting' || callStatus === 'ending'

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getStatusColor = () => {
    switch (callStatus) {
      case 'connecting': return 'bg-yellow-500'
      case 'active': return 'bg-green-500'
      case 'ending': return 'bg-orange-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = () => {
    switch (callStatus) {
      case 'connecting': return 'Connecting...'
      case 'active': return 'Call Active'
      case 'ending': return 'Ending Call...'
      case 'error': return 'Error'
      default: return 'Ready'
    }
  }

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Phone className="h-5 w-5" />
          {agentName}
        </CardTitle>
        <CardDescription>
          Browser-based voice conversation using Vapi web SDK
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", getStatusColor())} />
          <span className="text-sm font-medium">{getStatusText()}</span>
          {callId && (
            <Badge variant="outline" className="text-xs">
              {callId.slice(0, 8)}...
            </Badge>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="h-6 px-2 text-xs"
              >
                ✕
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Call Controls */}
        <div className="flex items-center justify-center gap-3">
          {!isCallActive && !hideStartButton ? (
            <Button
              onClick={() => {
                console.log('🎯 Start Call button clicked')
                console.log('🔍 Current state - isCallActive:', isCallActive)
                console.log('🔍 Current state - callStatus:', callStatus)
                console.log('🔍 Current state - error:', error)
                startCall()
              }}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mic className="h-4 w-4 mr-2" />
              )}
              Start Call
            </Button>
          ) : isCallActive ? (
            <div className="flex gap-2">
              <Button
                onClick={toggleMute}
                variant={isMuted ? "destructive" : "outline"}
                size="sm"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={() => {
                  console.log('🛑 End Call button clicked')
                  console.log('🔍 Current callId:', callId)
                  console.log('🔍 Current state - isCallActive:', isCallActive)
                  endCall()
                }}
                variant="destructive"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <PhoneOff className="h-4 w-4 mr-2" />
                )}
                End Call
              </Button>
            </div>
          ) : null}
        </div>

        {/* Live Messages */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Live Transcript
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            {/* Show completed messages */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex items-start gap-2 p-2 rounded",
                  message.role === 'user' 
                    ? "bg-blue-100 dark:bg-blue-900/20" 
                    : "bg-gray-100 dark:bg-gray-700"
                )}
              >
                <div className="flex-shrink-0 mt-1">
                  {message.role === 'user' ? (
                    <User className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Bot className="h-4 w-4 text-green-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 mb-1">
                    {message.role === 'user' ? 'You' : agentName}
                  </div>
                  <div className="text-sm">{message.transcript}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Show partial transcript if active */}
            {currentPartialTranscript.role && currentPartialTranscript.text && (
              <div
                className={cn(
                  "flex items-start gap-2 p-2 rounded border-2 border-dashed",
                  currentPartialTranscript.role === 'user' 
                    ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200" 
                    : "bg-gray-50 dark:bg-gray-800 border-gray-300"
                )}
              >
                <div className="flex-shrink-0 mt-1">
                  {currentPartialTranscript.role === 'user' ? (
                    <User className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Bot className="h-4 w-4 text-green-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 mb-1">
                    {currentPartialTranscript.role === 'user' ? 'You' : agentName}
                    <span className="ml-2 text-xs text-gray-400">(typing...)</span>
                  </div>
                  <div className="text-sm text-gray-600 italic">
                    {currentPartialTranscript.text}
                  </div>

                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Instructions */}
        {!isCallActive && (
          <div className="text-xs text-gray-500 text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p>Click "Start Call" to begin a voice conversation with {agentName}</p>
          </div>
        )}

        {/* Call Info */}
        {isCallActive && callId && (
          <div className="text-xs text-gray-500 text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p><strong>Call ID:</strong> {callId}</p>
            <p><strong>Status:</strong> {callStatus}</p>
            <p><strong>Messages:</strong> {messages.length}</p>
            <p><strong>Muted:</strong> {isMuted ? 'Yes' : 'No'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 