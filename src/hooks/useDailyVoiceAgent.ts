'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import DailyIframe, { type DailyCall } from '@daily-co/daily-js'

export interface DailyTranscript {
  id: string
  speaker: 'user' | 'agent'
  text: string
  timestamp: Date
  isFinal: boolean
}

interface DailyVoiceAgentState {
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  transcripts: DailyTranscript[]
  agentState: 'initializing' | 'listening' | 'thinking' | 'speaking'
  isMuted: boolean
  connectionTime: number
  roomUrl: string | null
}

interface DailyVoiceAgentActions {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  toggleMute: () => void
  clearTranscripts: () => void
}

interface DailyVoiceAgentConfig {
  agentName: string
  sessionEndpoint: string
}

export function useDailyVoiceAgent(
  { agentName, sessionEndpoint }: DailyVoiceAgentConfig
): [DailyVoiceAgentState, DailyVoiceAgentActions] {
  const [isConnected, setIsConnected]         = useState(false)
  const [isConnecting, setIsConnecting]       = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [transcripts, setTranscripts]         = useState<DailyTranscript[]>([])
  const [agentState, setAgentState]           = useState<DailyVoiceAgentState['agentState']>('initializing')
  const [isMuted, setIsMuted]                 = useState(false)
  const [connectionTime, setConnectionTime]   = useState(0)
  const [roomUrl, setRoomUrl]                 = useState<string | null>(null)

  const callRef        = useRef<DailyCall | null>(null)
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioElsRef    = useRef<Set<HTMLAudioElement>>(new Set())

  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => setConnectionTime(p => p + 1), 1000)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setConnectionTime(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isConnected])

  const upsertTranscript = useCallback((t: DailyTranscript) => {
    setTranscripts(prev => {
      const i = prev.findIndex(x => x.id === t.id)
      if (i >= 0) { const u = [...prev]; u[i] = t; return u }
      return [...prev.slice(-99), t]
    })
  }, [])

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return
    if (!agentName?.trim()) { setConnectionError('Agent name is required'); return }
    setIsConnecting(true); setConnectionError(null)

    try {
      const res = await fetch(sessionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_name: agentName, user_name: 'Web User' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || `Session start failed: ${res.status}`)
      }
      const session = await res.json()
      // session: { room_url, token, agent_name }

      if (!session.room_url) throw new Error('No room_url in session response')
      if (!session.token)    throw new Error('No token in session response')

      setRoomUrl(session.room_url)

      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
      })
      callRef.current = call

      call.on('joined-meeting', () => {
        setIsConnected(true)
        setIsConnecting(false)
        setAgentState('listening')
      })

      call.on('left-meeting', () => {
        setIsConnected(false)
        setIsConnecting(false)
        setAgentState('initializing')
      })

      call.on('error', (ev: any) => {
        setConnectionError((ev as any).errorMsg || 'Call error')
        setIsConnecting(false)
      })

      call.on('track-started', (ev: any) => {
        // createCallObject() does NOT auto-play remote audio — attach it manually.
        if (ev?.participant?.local) return
        if (ev?.track?.kind !== 'audio') return
        const el = document.createElement('audio')
        el.srcObject = new MediaStream([ev.track])
        el.autoplay = true
        document.body.appendChild(el)
        audioElsRef.current.add(el)
      })

      call.on('track-stopped', (ev: any) => {
        // Clean up audio elements when the bot's track ends.
        if (ev?.participant?.local) return
        if (ev?.track?.kind !== 'audio') return
        audioElsRef.current.forEach(el => {
          const stream = el.srcObject as MediaStream | null
          if (stream?.getTracks().includes(ev.track)) {
            el.remove()
            audioElsRef.current.delete(el)
          }
        })
      })

      call.on('app-message', (ev: any) => {
        try {
          const data = (ev as any).data
          if (data?.type === 'agent_state' &&
              ['listening', 'thinking', 'speaking'].includes(data.state)) {
            setAgentState(data.state)
          } else if (data?.type === 'transcript' && data.text?.trim()) {
            upsertTranscript({
              id: `${data.speaker}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              speaker: data.speaker,
              text: data.text.trim(),
              timestamp: new Date(),
              isFinal: true,
            })
          }
        } catch {}
      })

      await call.join({ url: session.room_url, token: session.token })
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Connection failed')
      setIsConnecting(false)
      try { callRef.current?.destroy() } catch {}
      callRef.current = null
      setRoomUrl(null)
    }
  }, [agentName, isConnecting, isConnected, sessionEndpoint, upsertTranscript])

  const cleanupAudio = useCallback(() => {
    audioElsRef.current.forEach(el => el.remove())
    audioElsRef.current.clear()
  }, [])

  const disconnect = useCallback(async () => {
    try { await callRef.current?.leave() } catch {}
    try { callRef.current?.destroy() } catch {}
    callRef.current = null
    cleanupAudio()
    setIsConnected(false)
    setIsConnecting(false)
    setIsMuted(false)
    setTranscripts([])
    setAgentState('initializing')
    setConnectionError(null)
    setRoomUrl(null)
  }, [cleanupAudio])

  const toggleMute = useCallback(() => {
    if (!callRef.current) return
    const next = !isMuted
    callRef.current.setLocalAudio(!next)
    setIsMuted(next)
  }, [isMuted])

  const clearTranscripts = useCallback(() => setTranscripts([]), [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { callRef.current?.leave() } catch {}
      try { callRef.current?.destroy() } catch {}
      if (timerRef.current) clearInterval(timerRef.current)
      audioElsRef.current.forEach(el => el.remove())
      audioElsRef.current.clear()
    }
  }, [])

  return [
    { isConnected, isConnecting, connectionError, transcripts, agentState, isMuted, connectionTime, roomUrl },
    { connect, disconnect, toggleMute, clearTranscripts },
  ]
}
