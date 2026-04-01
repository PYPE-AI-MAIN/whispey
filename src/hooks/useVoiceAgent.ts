'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Room, 
  RoomEvent, 
  RemoteTrack, 
  RemoteParticipant, 
  Track,
  TranscriptionSegment,
  Participant,
  DisconnectReason,
  LocalTrackPublication,
  DataPacket_Kind
} from 'livekit-client'

export type AgentTestMode = 'voice' | 'chat'

interface WebSession {
  room: string
  user_token: string
  agent_name: string
  dispatch_cli_output: string
  url?: string
  room_name?: string
  token?: string
  participant_identity?: string
}

export interface Transcript {
  id: string
  speaker: 'user' | 'agent'
  text: string
  timestamp: Date
  isFinal: boolean
  participantIdentity?: string
}

interface VoiceAgentState {
  room: Room | null
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  transcripts: Transcript[]
  agentParticipant: RemoteParticipant | null
  agentState: 'initializing' | 'listening' | 'thinking' | 'speaking'
  isMuted: boolean
  volume: number
  connectionTime: number
  webSession: WebSession | null
}

interface VoiceAgentActions {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  toggleMute: () => Promise<void>
  setVolume: (volume: number) => void
  clearTranscripts: () => void
  sendChatMessage: (message: string) => Promise<void>
}

interface VoiceAgentConfig {
  agentName: string
  mode: AgentTestMode
}

function getSecureRandomInt(max: number): number {
  const UINT32_MAX = 0xFFFFFFFF
  const threshold = Math.floor((UINT32_MAX + 1) / max) * max
  let randomInt: number
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const array = new Uint32Array(1)
    do { window.crypto.getRandomValues(array); randomInt = array[0] } while (randomInt >= threshold)
    return randomInt % max
  }
  return Math.floor(Math.random() * max)
}

function generateSecureId(prefix = 'user') {
  return `${prefix}_${Date.now()}_${getSecureRandomInt(100000)}`
}

function isAgentParticipant(identity = '', metadata = '') {
  const id = identity.toLowerCase()
  const m  = metadata.toLowerCase()
  return id.includes('agent') || id.includes('assistant') || m.includes('agent') || m.includes('assistant')
}

export function useVoiceAgent({ agentName, mode }: VoiceAgentConfig): [VoiceAgentState, VoiceAgentActions] {
  const [room, setRoom]                       = useState<Room | null>(null)
  const [isConnected, setIsConnected]         = useState(false)
  const [isConnecting, setIsConnecting]       = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [transcripts, setTranscripts]         = useState<Transcript[]>([])
  const [agentParticipant, setAgentParticipant] = useState<RemoteParticipant | null>(null)
  const [agentState, setAgentState]           = useState<VoiceAgentState['agentState']>('initializing')
  const [isMuted, setIsMuted]                 = useState(false)
  const [volume, setVolumeState]              = useState(80)
  const [connectionTime, setConnectionTime]   = useState(0)
  const [webSession, setWebSession]           = useState<WebSession | null>(null)

  const connectionTimeInterval = useRef<NodeJS.Timeout | null>(null)
  const audioElementsRef       = useRef<Set<HTMLAudioElement>>(new Set())
  const roomRef                = useRef<Room | null>(null)

  useEffect(() => { roomRef.current = room }, [room])

  useEffect(() => {
    if (isConnected) {
      connectionTimeInterval.current = setInterval(() => setConnectionTime(p => p + 1), 1000)
    } else {
      if (connectionTimeInterval.current) { clearInterval(connectionTimeInterval.current); connectionTimeInterval.current = null }
      setConnectionTime(0)
    }
    return () => { if (connectionTimeInterval.current) clearInterval(connectionTimeInterval.current) }
  }, [isConnected])

  const cleanupAudioElements = useCallback(() => {
    audioElementsRef.current.forEach(audio => { try { audio.pause(); audio.remove() } catch {} })
    audioElementsRef.current.clear()
  }, [])

  const upsertTranscript = useCallback((t: Transcript) => {
    setTranscripts(prev => {
      const i = prev.findIndex(x => x.id === t.id)
      if (i >= 0) { const u = [...prev]; u[i] = t; return u }
      return [...prev.slice(-99), t]
    })
  }, [])

  const setupRoomListeners = useCallback((liveKitRoom: Room) => {
    liveKitRoom.on(RoomEvent.Connected,    () => { setIsConnected(true); setIsConnecting(false); setConnectionError(null) })
    liveKitRoom.on(RoomEvent.Disconnected, () => { setIsConnected(false); setIsConnecting(false); setAgentParticipant(null); setAgentState('initializing'); cleanupAudioElements() })
    liveKitRoom.on(RoomEvent.Reconnecting, () => setConnectionError('Reconnecting...'))
    liveKitRoom.on(RoomEvent.Reconnected,  () => setConnectionError(null))

    liveKitRoom.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
      if (isAgentParticipant(p.identity, p.metadata ?? '')) { setAgentParticipant(p); setAgentState('listening') }
    })
    liveKitRoom.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
      if (isAgentParticipant(p.identity, p.metadata ?? '')) { setAgentParticipant(null); setAgentState('initializing') }
    })

    // Audio tracks — voice mode only; chat mode is text-only, no audio
    if (mode === 'voice') {
      liveKitRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio) return
        try {
          const el = document.createElement('audio')
          el.volume = volume / 100; el.autoplay = true
          el.setAttribute('playsinline', 'true'); el.style.display = 'none'
          document.body.appendChild(el)
          audioElementsRef.current.add(el)
          track.attach(el)
          track.addListener('ended', () => { try { track.detach(el); el.remove(); audioElementsRef.current.delete(el) } catch {} })
        } catch (e) { console.error('Audio setup error', e) }
      })
    }

    // VOICE: RoomEvent.TranscriptionReceived only — prevents duplicates
    if (mode === 'voice') {
      liveKitRoom.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[], participant?: Participant) => {
        const fromAgent = isAgentParticipant(participant?.identity ?? '', participant?.metadata ?? '')
        segments.forEach(seg => {
          if (!seg.text?.trim()) return
          upsertTranscript({
            id: seg.id || generateSecureId('seg'),
            speaker: fromAgent ? 'agent' : 'user',
            text: seg.text.trim(),
            timestamp: new Date(),
            isFinal: seg.final ?? false,
            participantIdentity: participant?.identity,
          })
        })
      })
    }

    // CHAT: text stream handler only — prevents duplicates
    if (mode === 'chat') {
      liveKitRoom.registerTextStreamHandler('lk.transcription', async (reader, participantInfo) => {
        const attrs     = reader.info.attributes ?? {}
        const segId     = attrs['lk.segment_id'] || reader.info.id
        const fromAgent = isAgentParticipant(participantInfo.identity)
        let accumulated = ''
        try {
          for await (const chunk of reader) {
            accumulated += chunk
            upsertTranscript({ id: segId, speaker: fromAgent ? 'agent' : 'user', text: accumulated, timestamp: new Date(), isFinal: false })
          }
        } catch { /* stream closed */ }
        if (accumulated.trim()) {
          upsertTranscript({ id: segId, speaker: fromAgent ? 'agent' : 'user', text: accumulated.trim(), timestamp: new Date(), isFinal: true })
        }
      })
    }

    liveKitRoom.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload))
        if (data.type === 'agent_state' && ['initializing','listening','thinking','speaking'].includes(data.state)) {
          setAgentState(data.state)
        }
      } catch {}
    })

    liveKitRoom.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
      if (pub.kind === Track.Kind.Audio) setIsMuted(pub.isMuted)
    })

  }, [mode, volume, upsertTranscript, cleanupAudioElements])

  const startWebSession = async (): Promise<WebSession> => {
    const res = await fetch('/api/agents/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_identity: generateSecureId('user'), user_name: `User ${getSecureRandomInt(10000)}`, agent_name: agentName }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Failed to start web session: ${res.status} - ${err.error}`)
    }
    return res.json()
  }

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return
    if (!agentName?.trim()) { setConnectionError('Agent name is required'); return }
    setIsConnecting(true); setConnectionError(null)
    try {
      const sessionData = await startWebSession()
      setWebSession(sessionData)
      const liveKitRoom = new Room({
        audioCaptureDefaults: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
        publishDefaults: { audioPreset: { maxBitrate: 20000 }, simulcast: false },
        adaptiveStream: true, disconnectOnPageLeave: true,
      })
      setRoom(liveKitRoom)
      setupRoomListeners(liveKitRoom)
      if (!sessionData.url) throw new Error('No LiveKit URL. Check NEXT_PUBLIC_LIVEKIT_URL.')
      if (!sessionData.token && !sessionData.user_token) throw new Error('No token in session response.')
      await liveKitRoom.connect(sessionData.url, sessionData.token || sessionData.user_token!, { autoSubscribe: true })
      if (mode === 'voice') {
        await liveKitRoom.localParticipant.setMicrophoneEnabled(true).catch(e => console.warn('Mic enable failed:', e))
      }
      // chat mode: mic stays off, no audio elements created
    } catch (error) {
      console.error('Connect failed:', error)
      setConnectionError(error instanceof Error ? error.message : 'Connection failed')
      setIsConnecting(false)
      try { room?.disconnect() } catch {}
      setRoom(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentName, isConnecting, isConnected, mode, setupRoomListeners, room])

  const disconnect = useCallback(async () => {
    try { if (roomRef.current) { roomRef.current.disconnect(); setRoom(null) } } catch {}
    setIsConnected(false); setIsConnecting(false); setIsMuted(false)
    setWebSession(null); setTranscripts([]); setAgentState('initializing')
    setConnectionError(null); setAgentParticipant(null)
    cleanupAudioElements()
  }, [cleanupAudioElements])

  const toggleMute = useCallback(async () => {
    if (!roomRef.current?.localParticipant) return
    try { await roomRef.current.localParticipant.setMicrophoneEnabled(isMuted); setIsMuted(!isMuted) }
    catch (e) { console.error('Mute toggle failed', e) }
  }, [isMuted])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(100, v))
    setVolumeState(clamped)
    audioElementsRef.current.forEach(el => { try { el.volume = clamped / 100 } catch {} })
  }, [])

  const clearTranscripts = useCallback(() => setTranscripts([]), [])

  const sendChatMessage = useCallback(async (message: string) => {
    if (!roomRef.current || !isConnected) throw new Error('Not connected to room')
    const trimmed = message.trim()
    if (!trimmed) throw new Error('Message cannot be empty')
    await roomRef.current.localParticipant.sendText(trimmed, { topic: 'lk.chat' })
    upsertTranscript({
      id: generateSecureId('chat_user'),
      speaker: 'user',
      text: trimmed,
      timestamp: new Date(),
      isFinal: true,
    })
  }, [isConnected, upsertTranscript])

  useEffect(() => {
    return () => {
      try { if (roomRef.current && isConnected) roomRef.current.disconnect() } catch {}
      cleanupAudioElements()
      if (connectionTimeInterval.current) clearInterval(connectionTimeInterval.current)
    }
  }, [isConnected, cleanupAudioElements])

  return [
    { room, isConnected, isConnecting, connectionError, transcripts, agentParticipant, agentState, isMuted, volume, connectionTime, webSession },
    { connect, disconnect, toggleMute, setVolume, clearTranscripts, sendChatMessage },
  ]
}