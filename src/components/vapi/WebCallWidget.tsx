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

type CallStatus = 'idle' | 'connecting' | 'active' | 'ending' | 'error'

const STATUS_STYLE: Record<string, { color: string; text: string }> = {
  connecting: { color: 'bg-yellow-500', text: 'Connecting...' },
  active: { color: 'bg-green-500', text: 'Call Active' },
  ending: { color: 'bg-orange-500', text: 'Ending Call...' },
  error: { color: 'bg-red-500', text: 'Error' },
}
const DEFAULT_STATUS = { color: 'bg-muted-foreground', text: 'Ready' }

function RoleIcon({ role }: Readonly<{ role: 'user' | 'assistant' }>) {
  return role === 'user' ? <User className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-success" />
}

function TranscriptMessage({ message, agentName }: Readonly<{ message: { id: string; role: 'user' | 'assistant'; transcript: string; timestamp: Date }; agentName: string }>) {
  return (
    <div className={cn("flex items-start gap-2 p-2 rounded", message.role === 'user' ? "bg-primary/15" : "bg-muted")}>
      <div className="flex-shrink-0 mt-1"><RoleIcon role={message.role} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground mb-1">{message.role === 'user' ? 'You' : agentName}</div>
        <div className="text-sm">{message.transcript}</div>
        <div className="text-xs text-muted-foreground mt-1">{message.timestamp.toLocaleTimeString()}</div>
      </div>
    </div>
  )
}

function PartialTranscript({ role, text, agentName }: Readonly<{ role: 'user' | 'assistant'; text: string; agentName: string }>) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 p-2 rounded border-2 border-dashed",
        role === 'user' ? "bg-primary/10 border-primary/30" : "bg-muted/50 border-border"
      )}
    >
      <div className="flex-shrink-0 mt-1"><RoleIcon role={role} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground mb-1">
          {role === 'user' ? 'You' : agentName}
          <span className="ml-2 text-xs text-muted-foreground">(typing...)</span>
        </div>
        <div className="text-sm text-muted-foreground italic">{text}</div>
      </div>
    </div>
  )
}

function CallControls({ isCallActive, hideStartButton, isLoading, isMuted, onStart, onEnd, onToggleMute }: Readonly<{
  isCallActive: boolean
  hideStartButton: boolean
  isLoading: boolean
  isMuted: boolean
  onStart: () => void
  onEnd: () => void
  onToggleMute: () => void
}>) {
  if (isCallActive) {
    return (
      <div className="flex gap-2">
        <Button onClick={onToggleMute} variant={isMuted ? "destructive" : "outline"} size="sm">
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <Button onClick={onEnd} variant="destructive" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PhoneOff className="h-4 w-4 mr-2" />}
          End Call
        </Button>
      </div>
    )
  }
  if (hideStartButton) return null
  return (
    <Button onClick={onStart} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
      Start Call
    </Button>
  )
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
  const status = STATUS_STYLE[callStatus as CallStatus] ?? DEFAULT_STATUS
  const partial = currentPartialTranscript

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
        <div className="flex items-center justify-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", status.color)} />
          <span className="text-sm font-medium">{status.text}</span>
          {callId && (
            <Badge variant="outline" className="text-xs">
              {callId.slice(0, 8)}...
            </Badge>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={clearError} className="h-7 px-2 text-xs">
                ✕
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-center gap-3">
          <CallControls
            isCallActive={isCallActive}
            hideStartButton={hideStartButton}
            isLoading={isLoading}
            isMuted={isMuted}
            onStart={startCall}
            onEnd={endCall}
            onToggleMute={toggleMute}
          />
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Live Transcript
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-muted/50 rounded-lg">
            {messages.map((message) => (
              <TranscriptMessage key={message.id} message={message} agentName={agentName} />
            ))}
            {partial.role && partial.text && (
              <PartialTranscript role={partial.role} text={partial.text} agentName={agentName} />
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {!isCallActive && (
          <div className="text-xs text-muted-foreground text-center p-3 bg-muted/50 rounded-lg">
            <p>Click "Start Call" to begin a voice conversation with {agentName}</p>
          </div>
        )}

        {isCallActive && callId && (
          <div className="text-xs text-muted-foreground text-center p-2 bg-primary/10 rounded-lg border border-primary/30">
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
