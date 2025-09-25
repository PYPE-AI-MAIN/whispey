// Fixed useVoiceAgent.ts - Security improvements for random generation
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Room, 
  RoomEvent, 
  RemoteTrack, 
  RemoteParticipant, 
  LocalParticipant,
  Track,
  TranscriptionSegment,
  RemoteTrackPublication,
  TrackPublication,
  Participant,
  ConnectionState,
  DisconnectReason,
  LocalTrackPublication,
  DataPacket_Kind
} from 'livekit-client'

interface VoiceAgentConfig {
  agentName: string
  apiBaseUrl?: string
}

// FIXED: Updated interface to match your API response
interface WebSession {
  room: string              // Changed from room_name
  user_token: string        // Changed from token  
  agent_name: string
  dispatch_cli_output: string
  // We'll add these fields during processing
  url?: string
  room_name?: string        // For backward compatibility
  token?: string            // For backward compatibility
  participant_identity?: string
}

// Rest of interfaces remain the same...
interface Transcript {
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
  sendTextMessage: (message: string) => Promise<void>
}

// SECURITY FIX: Cryptographically secure random number generator with unbiased distribution
function getSecureRandomInt(max: number): number {
  if (typeof max !== 'number' || !Number.isInteger(max) || max <= 0) {
    throw new Error('max must be a positive integer')
  }

  // Use rejection sampling to eliminate modulo bias
  const UINT32_MAX = 0xFFFFFFFF
  const threshold = Math.floor((UINT32_MAX + 1) / max) * max
  
  let randomInt: number

  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    // Browser environment - use Web Crypto API with rejection sampling
    const array = new Uint32Array(1)
    do {
      window.crypto.getRandomValues(array)
      randomInt = array[0]
    } while (randomInt >= threshold)
    return randomInt % max
  } else if (typeof require !== 'undefined') {
    // Node.js environment - use crypto module with rejection sampling
    try {
      const crypto = require('crypto')
      do {
        const bytes = crypto.randomBytes(4)
        randomInt = bytes.readUInt32BE(0)
      } while (randomInt >= threshold)
      return randomInt % max
    } catch (error) {
      console.warn('Failed to use crypto module, falling back to Math.random():', error)
      return Math.floor(Math.random() * max)
    }
  } else {
    // Fallback to Math.random() if crypto is not available
    console.warn('Crypto API not available, using Math.random() fallback')
    return Math.floor(Math.random() * max)
  }
}

// Alternative: Generate a more secure random string for identities
function generateSecureId(prefix: string = 'user'): string {
  const timestamp = Date.now()
  const randomPart = getSecureRandomInt(100000) // 5-digit random number
  return `${prefix}_${timestamp}_${randomPart}`
}

export function useVoiceAgent({ 
  agentName, 
  apiBaseUrl = process.env.NEXT_PUBLIC_PYPEAI_API_URL 
}: VoiceAgentConfig): [VoiceAgentState, VoiceAgentActions] {
  // State (unchanged)
  const [room, setRoom] = useState<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [agentParticipant, setAgentParticipant] = useState<RemoteParticipant | null>(null)
  const [agentState, setAgentState] = useState<'initializing' | 'listening' | 'thinking' | 'speaking'>('initializing')
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolumeState] = useState(80)
  const [connectionTime, setConnectionTime] = useState(0)
  const [webSession, setWebSession] = useState<WebSession | null>(null)

  // Refs (unchanged)
  const connectionTimeInterval = useRef<NodeJS.Timeout | null>(null)
  const audioElementsRef = useRef<Set<HTMLAudioElement>>(new Set())
  const roomRef = useRef<Room | null>(null)

  // Keep roomRef in sync
  useEffect(() => {
    roomRef.current = room
  }, [room])

  // Connection timer (unchanged)
  useEffect(() => {
    if (isConnected) {
      connectionTimeInterval.current = setInterval(() => {
        setConnectionTime(prev => prev + 1)
      }, 1000)
    } else {
      if (connectionTimeInterval.current) {
        clearInterval(connectionTimeInterval.current)
        connectionTimeInterval.current = null
      }
      setConnectionTime(0)
    }

    return () => {
      if (connectionTimeInterval.current) {
        clearInterval(connectionTimeInterval.current)
      }
    }
  }, [isConnected])

  // SECURITY FIX: Updated startWebSession with secure random generation
  const startWebSession = async (): Promise<WebSession> => {
    if (!apiBaseUrl) {
      throw new Error('API base URL is not configured')
    }

    console.log('📞 Making request to:', `${apiBaseUrl}/start_web_session`)

    // Generate secure random identifiers
    const userIdentity = generateSecureId('user')
    const userName = `User ${getSecureRandomInt(10000)}` // Increased range for better uniqueness

    const response = await fetch(`${apiBaseUrl}/start_web_session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'pype-api-v1'
      },
      body: JSON.stringify({
        user_identity: userIdentity,
        user_name: userName,
        agent_name: agentName
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Failed to start web session: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const apiData = await response.json()
    console.log('✅ Raw API response:', apiData)

    // FIXED: Transform API response to expected format
    const transformedSession: WebSession = {
      // Map your API fields to expected fields
      room: apiData.room,
      user_token: apiData.user_token,
      agent_name: apiData.agent_name,
      dispatch_cli_output: apiData.dispatch_cli_output,
      
      // Add backward compatibility fields
      room_name: apiData.room,
      token: apiData.user_token,
      participant_identity: userIdentity, // Use the same secure identity we generated
      
      // CRITICAL: Add the LiveKit server URL
      // or replace this with your actual LiveKit server URL
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL || 
           `ws://${apiBaseUrl?.split('://')[1]?.split('/')[0]?.replace(':8000', ':7880')}` ||
           'ws://15.206.157.27:7880' // Fallback - adjust this to your actual LiveKit server
    }

    console.log('🔄 Transformed session data:', transformedSession)
    return transformedSession
  }

  // All other functions remain exactly the same...
  const cleanupAudioElements = useCallback(() => {
    audioElementsRef.current.forEach(audio => {
      try {
        audio.pause()
        audio.remove()
      } catch (error) {
        console.warn('Error cleaning up audio element:', error)
      }
    })
    audioElementsRef.current.clear()
  }, [])

  const setupRoomListeners = useCallback((liveKitRoom: Room) => {
    console.log('🎯 Setting up LiveKit room listeners')

    // Connection events
    liveKitRoom.on(RoomEvent.Connected, () => {
      console.log('✅ Connected to LiveKit room')
      setIsConnected(true)
      setIsConnecting(false)
      setConnectionError(null)
    })

    liveKitRoom.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      console.log('❌ Disconnected from LiveKit room:', reason)
      setIsConnected(false)
      setIsConnecting(false)
      setAgentParticipant(null)
      setAgentState('initializing')
      cleanupAudioElements()
    })

    liveKitRoom.on(RoomEvent.Reconnecting, () => {
      console.log('🔄 Reconnecting to LiveKit room...')
      setConnectionError('Reconnecting...')
    })

    liveKitRoom.on(RoomEvent.Reconnected, () => {
      console.log('✅ Reconnected to LiveKit room')
      setConnectionError(null)
    })

    // Participant events
    liveKitRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('👤 Participant connected:', participant.identity, 'metadata:', participant.metadata)
      
      // Detect agent participant - check various indicators
      const isAgent = participant.identity.toLowerCase().includes('agent') || 
                     participant.identity.toLowerCase().includes('assistant') ||
                     participant.metadata?.toLowerCase().includes('agent') ||
                     participant.metadata?.toLowerCase().includes('assistant')
      
      if (isAgent) {
        setAgentParticipant(participant)
        console.log('🤖 Agent participant detected:', participant.identity)
        setAgentState('listening')
      }
    })

    liveKitRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('👤 Participant disconnected:', participant.identity)
      if (participant === agentParticipant) {
        setAgentParticipant(null)
        setAgentState('initializing')
      }
    })

    // Track events
    liveKitRoom.on(RoomEvent.TrackSubscribed, (
      track: RemoteTrack, 
      publication: RemoteTrackPublication, 
      participant: RemoteParticipant
    ) => {
      console.log('🎵 Track subscribed:', track.kind, 'from', participant.identity)
      
      if (track.kind === Track.Kind.Audio) {
        try {
          // Create audio element
          const audioElement = document.createElement('audio')
          audioElement.volume = volume / 100
          audioElement.autoplay = true
          audioElement.setAttribute('playsinline', 'true')
          audioElement.style.display = 'none'
          
          // Add event listeners for debugging
          audioElement.addEventListener('play', () => {
            console.log('🔊 Audio element started playing')
          })
          
          audioElement.addEventListener('error', (e) => {
            console.error('❌ Audio element error:', e)
          })
          
          // Add to DOM and track it
          document.body.appendChild(audioElement)
          audioElementsRef.current.add(audioElement)
          
          // Attach track
          track.attach(audioElement)
          
          console.log('🔊 Audio track attached')

          // Clean up when track ends
          const cleanup = () => {
            try {
              track.detach(audioElement)
              audioElement.remove()
              audioElementsRef.current.delete(audioElement)
              console.log('🧹 Audio track cleaned up')
            } catch (error) {
              console.warn('Error during audio cleanup:', error)
            }
          }

          track.addListener('ended', cleanup)
          track.addListener('muted', () => {
            console.log('🔇 Audio track muted')
          })
          track.addListener('unmuted', () => {
            console.log('🔊 Audio track unmuted')
          })
        } catch (error) {
          console.error('❌ Error setting up audio track:', error)
        }
      }
    })

    liveKitRoom.on(RoomEvent.TrackUnsubscribed, (
      track: RemoteTrack, 
      publication: RemoteTrackPublication, 
      participant: RemoteParticipant
    ) => {
      console.log('🎵 Track unsubscribed:', track.kind, 'from', participant.identity)
    })

    // Transcription events
    liveKitRoom.on(RoomEvent.TranscriptionReceived, (
      segments: TranscriptionSegment[], 
      participant?: Participant, 
      publication?: TrackPublication
    ) => {
      console.log('📝 Transcription received:', segments.length, 'segments from', participant?.identity)
      
      segments.forEach(segment => {
        if (!segment.text?.trim()) return
        
        const isFromAgent = participant?.identity.toLowerCase().includes('agent') || 
                           participant?.identity.toLowerCase().includes('assistant') ||
                           participant?.metadata?.toLowerCase().includes('agent') ||
                           participant?.metadata?.toLowerCase().includes('assistant')
        
        const transcript: Transcript = {
          id: segment.id || `${Date.now()}_${getSecureRandomInt(100000)}`, // SECURITY FIX: Use secure random
          speaker: isFromAgent ? 'agent' : 'user',
          text: segment.text.trim(),
          timestamp: new Date(),
          isFinal: segment.final ?? false,
          participantIdentity: participant?.identity
        }
        
        setTranscripts(prev => {
          const existingIndex = prev.findIndex(t => t.id === transcript.id)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = transcript
            return updated
          } else {
            return [...prev.slice(-99), transcript]
          }
        })

        console.log(`📝 ${transcript.speaker.toUpperCase()}: "${transcript.text}" ${transcript.isFinal ? '(final)' : '(partial)'}`)
      })
    })

    // Data messages for agent state
    liveKitRoom.on(RoomEvent.DataReceived, (
      payload: Uint8Array, 
      participant?: RemoteParticipant, 
      kind?: DataPacket_Kind,
      topic?: string
    ) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload))
        
        if (data.type === 'agent_state' && participant && participant === agentParticipant) {
          const newState = data.state as 'initializing' | 'listening' | 'thinking' | 'speaking'
          if (['initializing', 'listening', 'thinking', 'speaking'].includes(newState)) {
            setAgentState(newState)
            console.log('🤖 Agent state updated:', newState)
          }
        }
        
        if (data.type === 'agent_message') {
          console.log('📨 Agent message:', data.message)
        }
      } catch (error) {
        console.log('📦 Non-JSON data received:', payload.length, 'bytes')
      }
    })

    // Local track events
    liveKitRoom.on(RoomEvent.LocalTrackPublished, (publication: LocalTrackPublication) => {
      console.log('📤 Local track published:', publication.kind)
      if (publication.kind === Track.Kind.Audio) {
        setIsMuted(publication.isMuted)
      }
    })

    liveKitRoom.on(RoomEvent.LocalTrackUnpublished, (publication: LocalTrackPublication) => {
      console.log('📤 Local track unpublished:', publication.kind)
    })

    // Connection quality events
    liveKitRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (participant === liveKitRoom.localParticipant) {
        console.log('📶 Local connection quality:', quality)
      }
    })

  }, [agentParticipant, volume, cleanupAudioElements])

  // FIXED: Updated to use correct field names
  const connect = useCallback(async () => {
    console.log('🚀 Starting connection to agent:', agentName)
    
    if (isConnecting || isConnected) {
      console.warn('⚠️ Already connecting or connected')
      return
    }

    if (!agentName?.trim()) {
      setConnectionError('Agent name is required')
      return
    }

    setIsConnecting(true)
    setConnectionError(null)

    try {
      // Start web session
      console.log('📞 Starting web session...')
      const sessionData = await startWebSession()
      setWebSession(sessionData)
      
      console.log('✅ Web session started. Room:', sessionData.room)
      console.log('🔌 Will connect to:', sessionData.url)

      // Create and configure room
      const liveKitRoom = new Room({
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        publishDefaults: {
          audioPreset: {
            maxBitrate: 20000,
          },
          simulcast: false,
        },
        adaptiveStream: true,
        disconnectOnPageLeave: true,
      })

      setRoom(liveKitRoom)
      
      // Setup event listeners before connecting
      setupRoomListeners(liveKitRoom)
      
      // FIXED: Use correct field names and add error checking
      if (!sessionData.url) {
        throw new Error('No LiveKit server URL provided. Check NEXT_PUBLIC_LIVEKIT_URL environment variable.')
      }
      
      if (!sessionData.token && !sessionData.user_token) {
        throw new Error('No authentication token provided by API')
      }

      // Connect to room
      console.log('🔌 Connecting to LiveKit room:', sessionData.url)
      await liveKitRoom.connect(
        sessionData.url, 
        sessionData.token || sessionData.user_token!, 
        {
          autoSubscribe: true,
        }
      )
      
      // Enable microphone after connection
      try {
        await liveKitRoom.localParticipant.setMicrophoneEnabled(true)
      } catch (micError) {
        console.warn('⚠️ Failed to enable microphone:', micError)
      }
      
      console.log('✅ Successfully connected to LiveKit room')
      
    } catch (error) {
      console.error('❌ Failed to connect to voice agent:', error)
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      setConnectionError(errorMessage)
      setIsConnecting(false)
      
      // Clean up on error
      if (room) {
        try {
          room.disconnect()
        } catch (disconnectError) {
          console.warn('Error disconnecting after failed connection:', disconnectError)
        }
        setRoom(null)
      }
    }
  }, [agentName, isConnecting, isConnected, setupRoomListeners, room])

  // All other methods remain the same...
  const disconnect = useCallback(async () => {
    console.log('🔌 Disconnecting from voice agent')
    
    try {
      if (roomRef.current) {
        roomRef.current.disconnect()
        setRoom(null)
      }
    } catch (error) {
      console.warn('Error during disconnect:', error)
    }
    
    setIsConnected(false)
    setIsConnecting(false)
    setIsMuted(false)
    setWebSession(null)
    setTranscripts([])
    setAgentState('initializing')
    setConnectionError(null)
    setAgentParticipant(null)
    
    cleanupAudioElements()
  }, [cleanupAudioElements])

  const toggleMute = useCallback(async () => {
    if (!roomRef.current?.localParticipant) {
      console.warn('⚠️ No room or local participant for mute toggle')
      return
    }

    try {
      const newMutedState = !isMuted
      await roomRef.current.localParticipant.setMicrophoneEnabled(!newMutedState)
      setIsMuted(newMutedState)
      console.log(newMutedState ? '🔇 Microphone muted' : '🎤 Microphone unmuted')
    } catch (error) {
      console.error('❌ Error toggling mute:', error)
      setConnectionError('Failed to toggle mute')
    }
  }, [isMuted])

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(100, newVolume))
    setVolumeState(clampedVolume)
    
    audioElementsRef.current.forEach(audio => {
      try {
        audio.volume = clampedVolume / 100
      } catch (error) {
        console.warn('Error setting audio volume:', error)
      }
    })
    
    console.log('🔊 Volume updated to:', clampedVolume)
  }, [])

  const clearTranscripts = useCallback(() => {
    setTranscripts([])
    console.log('🧹 Transcripts cleared')
  }, [])

  const sendTextMessage = useCallback(async (message: string) => {
    if (!roomRef.current || !isConnected) {
      throw new Error('Not connected to room')
    }

    if (!message?.trim()) {
      throw new Error('Message cannot be empty')
    }

    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(JSON.stringify({
        type: 'chat_message',
        text: message.trim(),
        timestamp: new Date().toISOString(),
        sender: 'user'
      }))
      
      await roomRef.current.localParticipant.publishData(data, { 
        reliable: true,
        topic: 'chat'
      })
      
      console.log('💬 Text message sent:', message.trim())
      
      const userTranscript: Transcript = {
        id: `user_${Date.now()}_${getSecureRandomInt(100000)}`, // SECURITY FIX: Use secure random
        speaker: 'user',
        text: message.trim(),
        timestamp: new Date(),
        isFinal: true,
        participantIdentity: roomRef.current.localParticipant.identity
      }
      
      setTranscripts(prev => [...prev.slice(-99), userTranscript])
      
    } catch (error) {
      console.error('❌ Failed to send text message:', error)
      throw new Error('Failed to send message')
    }
  }, [isConnected])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current && isConnected) {
        try {
          roomRef.current.disconnect()
        } catch (error) {
          console.warn('Error disconnecting on unmount:', error)
        }
      }
      
      cleanupAudioElements()

      if (connectionTimeInterval.current) {
        clearInterval(connectionTimeInterval.current)
      }
    }
  }, [isConnected, cleanupAudioElements])

  const state: VoiceAgentState = {
    room,
    isConnected,
    isConnecting,
    connectionError,
    transcripts,
    agentParticipant,
    agentState,
    isMuted,
    volume,
    connectionTime,
    webSession
  }

  const actions: VoiceAgentActions = {
    connect,
    disconnect,
    toggleMute,
    setVolume,
    clearTranscripts,
    sendTextMessage
  }

  return [state, actions]
}