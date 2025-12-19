'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ChatEntryProps extends React.HTMLAttributes<HTMLLIElement> {
  locale?: string
  timestamp: Date | number
  message: string
  messageOrigin: 'local' | 'remote'
  name?: string
  hasBeenEdited?: boolean
}

export const ChatEntry = ({ 
  name, 
  locale = 'en-US', 
  timestamp, 
  message, 
  messageOrigin, 
  hasBeenEdited = false, 
  className, 
  ...props 
}: ChatEntryProps) => {
  const time = typeof timestamp === 'number' ? new Date(timestamp) : timestamp
  const title = time.toLocaleTimeString(locale, { timeStyle: 'full' })
  
  const isLocal = messageOrigin === 'local'
  
  return (
    <li 
      title={title} 
      data-lk-message-origin={messageOrigin}
      className={cn('group flex w-full flex-col gap-0.5', isLocal && 'items-end', !isLocal && 'items-start', className)} 
      {...props}
    >
      <header className={cn(
        'text-muted-foreground flex items-center gap-2 text-sm',
        isLocal ? 'flex-row-reverse' : 'flex-row'
      )}>
        {name && <strong>{name}</strong>}
        <span className="font-mono text-xs opacity-0 transition-opacity ease-linear group-hover:opacity-100">
          {hasBeenEdited && '*'}
          {time.toLocaleTimeString(locale, { timeStyle: 'short' })}
        </span>
      </header>
      <span className={cn(
        'max-w-[75%] rounded-[20px] p-3',
        isLocal
          ? 'bg-muted text-right' 
          : 'bg-background border border-input/50 text-left'
      )}>
        {message}
      </span>
    </li>
  )
}
