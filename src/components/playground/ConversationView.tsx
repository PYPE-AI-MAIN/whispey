'use client'

import { useEffect, useRef } from 'react'
import { ChatEntry } from './ChatEntry'
import { cn } from '@/lib/utils'

interface Transcript {
  id: string
  speaker: 'user' | 'agent'
  text: string
  timestamp: Date
}

interface ConversationViewProps {
  transcripts: Transcript[]
  agentName: string
  hidden?: boolean
  className?: string
  agentState?: 'initializing' | 'listening' | 'thinking' | 'speaking'
}

export function ConversationView({ 
  transcripts, 
  agentName, 
  hidden = false,
  className,
  agentState
}: ConversationViewProps) {
  if (hidden) {
    return null
  }

  if (transcripts.length === 0) {
    if (agentState === 'initializing') {
      return (
        <div className={cn('flex items-center justify-center h-full', className)}>
          <p className="text-muted-foreground text-sm">Initializing...</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className={cn('space-y-3', className)}>
      {transcripts.map((transcript) => (
        <ChatEntry
          key={transcript.id}
          message={transcript.text}
          messageOrigin={transcript.speaker === 'user' ? 'local' : 'remote'}
          timestamp={transcript.timestamp}
          name={transcript.speaker === 'user' ? 'You' : agentName}
        />
      ))}
    </div>
  )
}
