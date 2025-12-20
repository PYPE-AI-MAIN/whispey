'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface BarVisualizerProps {
  state?: 'initializing' | 'listening' | 'thinking' | 'speaking'
  barCount?: number
  className?: string
}

export function BarVisualizer({ 
  state = 'listening', 
  barCount = 5,
  className 
}: BarVisualizerProps) {
  const [audioLevels, setAudioLevels] = useState<number[]>([])
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    const generateLevels = () => {
      const levels: number[] = []
      const baseLevel = state === 'speaking' ? 0.7 : state === 'listening' ? 0.4 : 0.1
      
      for (let i = 0; i < barCount; i++) {
        const variation = (Math.random() - 0.5) * 0.3
        const level = Math.max(0.1, Math.min(1, baseLevel + variation))
        levels.push(level)
      }
      
      setAudioLevels(levels)
    }

    generateLevels()
    intervalRef.current = setInterval(generateLevels, 100)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [state, barCount])

  const getColor = () => {
    switch (state) {
      case 'speaking':
        return 'bg-foreground'
      case 'listening':
        return 'bg-muted'
      case 'thinking':
        return 'bg-muted/50'
      default:
        return 'bg-muted'
    }
  }

  return (
    <div className={cn('flex h-full items-center justify-center gap-1', className)}>
      {audioLevels.map((level, index) => {
        const barHeight = 80 // Fixed height for bars
        return (
          <div
            key={index}
            className={cn(
              'w-2.5 rounded-full transition-all duration-250 ease-linear',
              getColor(),
              state === 'speaking' && 'data-[highlighted=true]:bg-foreground',
              state === 'listening' && 'data-[highlighted=true]:bg-muted'
            )}
            style={{
              height: `${barHeight}px`,
              opacity: level > 0.3 ? 1 : 0.5
            }}
          />
        )
      })}
    </div>
  )
}
