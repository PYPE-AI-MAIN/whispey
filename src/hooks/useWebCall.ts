import { useState, useEffect, useRef, useCallback } from 'react'
import Vapi from '@vapi-ai/web'

interface WebCallState {
  isCallActive: boolean
  isMuted: boolean
  callId: string | null
  callStatus: 'idle' | 'connecting' | 'active' | 'ending' | 'error'
  error: string | null
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    transcript: string
    timestamp: Date
  }>
  currentPartialTranscript: { role: 'user' | 'assistant' | null; text: string }
}

interface UseWebCallOptions {
  assistantId: string
  publicApiKey: string
  onCallStart?: (callId: string) => void
  onCallEnd?: (callId: string, reason: string) => void
  onTranscript?: (transcript: string, role: 'user' | 'assistant') => void
  onError?: (error: string) => void
}

export const useWebCall = ({
  assistantId,
  publicApiKey,
  onCallStart,
  onCallEnd,
  onTranscript,
  onError
}: UseWebCallOptions) => {
  const [state, setState] = useState<WebCallState>({
    isCallActive: false,
    isMuted: false,
    callId: null,
    callStatus: 'idle',
    error: null,
    messages: [],
    currentPartialTranscript: { role: null, text: '' }
  })

  const vapiRef = useRef<Vapi | null>(null)
  const isInitialized = useRef(false)
  const partialTranscriptTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize Vapi instance
  const initializeVapi = useCallback(async () => {
    console.log('🔄 initializeVapi called, checking initialization status...')
    if (isInitialized.current) {
      console.log('🔄 Vapi already initialized, skipping...')
      return
    }
    
    if (vapiRef.current) {
      console.log('🔄 Vapi instance already exists, skipping...')
      return
    }

    try {
      console.log('🚀 Starting Vapi initialization...')
      console.log('🔑 Public API Key (first 8 chars):', publicApiKey.slice(0, 8) + '...')
      console.log('🎯 Assistant ID:', assistantId)
      
      if (!publicApiKey || publicApiKey.trim() === '') {
        throw new Error('Public API key is empty or undefined')
      }
      
      if (!assistantId || assistantId.trim() === '') {
        throw new Error('Assistant ID is empty or undefined')
      }
      
      console.log('🏗️ Creating Vapi instance...')
      vapiRef.current = new Vapi(publicApiKey)
      console.log('✅ Vapi instance created successfully')
      
      // Set up event listeners
      console.log('🎧 Setting up event listeners...')
      
      vapiRef.current.on('call-start', (...args: any[]) => {
        console.log('📞 Call started event triggered')
        console.log('📊 Call event args:', args)
        const callData = args[0]
        console.log('📊 Call data:', callData)
        console.log('🆔 Call ID from event:', callData?.id || 'unknown')
        
        setState(prev => ({
          ...prev,
          callStatus: 'active',
          isCallActive: true,
          error: null
        }))
        
        // Store call ID if available
        if (callData?.id) {
          setState(prev => ({ ...prev, callId: callData.id }))
          console.log('💾 Call ID stored in state:', callData.id)
        }
        
        console.log('✅ Call start state updated successfully')
      })

      vapiRef.current.on('call-end', (...args: any[]) => {
        console.log('🛑 Call ended event triggered')
        console.log('📊 Call end event args:', args)
        const callData = args[0]
        console.log('📊 Call data:', callData)
        console.log('🔍 End reason:', callData?.reason || 'unknown')
        console.log('🔍 End status:', callData?.status || 'unknown')
        console.log('🔍 End metadata:', callData?.metadata || 'none')
        
        setState(prev => ({
          ...prev,
          callStatus: 'idle',
          isCallActive: false,
          callId: null
        }))
        
        const reason = callData?.reason || 'unknown'
        console.log('📞 Calling onCallEnd callback with reason:', reason)
        onCallEnd?.('unknown', reason)
        console.log('✅ Call end state updated successfully')
      })

      vapiRef.current.on('message', (...args: any[]) => {
        console.log('💬 Message event triggered')
        console.log('📊 Message event args:', args)
        const message = args[0]
        console.log('📊 Message data:', message)
        console.log('🔍 Message keys:', Object.keys(message))
        console.log('🔍 Message type:', message.type)
        console.log('🔍 Full message object:', JSON.stringify(message, null, 2))
        
        if (message.type === 'transcript') {
          console.log('💬 Processing transcript message')
          console.log('👤 Role:', message.role)
          console.log('📝 Transcript:', message.transcript)
          console.log('🔍 Is interim:', message.isInterim)
          console.log('🔍 Is final:', message.isFinal)
          console.log('🔍 Status:', message.status)
          console.log('⏰ Timestamp:', message.timestamp || 'now')
          
          const role = message.role as 'user' | 'assistant'
          const transcript = message.transcript
          
          // Check transcriptType property (this is what Vapi actually sends)
          const transcriptType = message.transcriptType
          const isInterim = transcriptType === 'partial'
          const isFinal = transcriptType === 'final'
          
          console.log('🔍 Vapi transcriptType:', transcriptType)
          console.log('🔍 Determined interim status:', { isInterim, isFinal })
          
          if (isInterim) {
            // Accumulate partial transcript
            console.log('📝 Accumulating partial transcript for role:', role)
            
            // Clear any existing timeout
            if (partialTranscriptTimeoutRef.current) {
              clearTimeout(partialTranscriptTimeoutRef.current)
            }
            
            setState(prev => ({
              ...prev,
              currentPartialTranscript: { role, text: transcript }
            }))
            
            // Set timeout to finalize partial transcript after 2 seconds of silence
            partialTranscriptTimeoutRef.current = setTimeout(() => {
              console.log('⏰ Timeout reached, finalizing partial transcript')
              setState(prev => {
                if (prev.currentPartialTranscript.role && prev.currentPartialTranscript.text) {
                  const finalMessage = {
                    id: Date.now().toString(),
                    role: prev.currentPartialTranscript.role,
                    transcript: prev.currentPartialTranscript.text,
                    timestamp: new Date()
                  }
                  
                  console.log('💾 Finalizing partial transcript as message:', finalMessage)
                  onTranscript?.(prev.currentPartialTranscript.text, prev.currentPartialTranscript.role)
                  
                  return {
                    ...prev,
                    messages: [...prev.messages, finalMessage],
                    currentPartialTranscript: { role: null, text: '' }
                  }
                }
                return prev
              })
            }, 2000) // 2 second timeout
          } else {
            // Final transcript - add to messages
            console.log('✅ Final transcript received for role:', role)
            
            // Check if we should merge with existing partial transcript
            const finalTranscript = transcript
            
            const newMessage = {
              id: Date.now().toString(),
              role,
              transcript: finalTranscript,
              timestamp: new Date()
            }

            console.log('💾 Adding final message to state:', newMessage)
            setState(prev => ({
              ...prev,
              messages: [...prev.messages, newMessage],
              currentPartialTranscript: { role: null, text: '' } // Clear partial
            }))

            console.log('📞 Calling onTranscript callback')
            onTranscript?.(finalTranscript, role)
            console.log('✅ Final transcript processed successfully')
          }
          

        } else {
          console.log('⚠️ Non-transcript message type:', message.type)
          console.log('📊 Full message:', message)
        }
      })

      vapiRef.current.on('error', (...args: any[]) => {
        console.log('❌ Vapi error event triggered')
        console.log('📊 Error event args:', args)
        const error = args[0]
        console.error('❌ Vapi error details:', error)
        console.error('❌ Error message:', error.message)
        console.error('❌ Error stack:', error.stack)
        console.error('❌ Error name:', error.name)
        
        const errorMessage = error.message || 'An error occurred during the call'
        console.log('📝 Setting error state with message:', errorMessage)
        
        setState(prev => ({
          ...prev,
          error: errorMessage,
          callStatus: 'error'
        }))
        
        console.log('📞 Calling onError callback')
        onError?.(errorMessage)
        console.log('✅ Error state updated successfully')
      })

      isInitialized.current = true
      console.log('✅ Vapi initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize Vapi:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Vapi'
      
      // Clean up on error
      if (vapiRef.current) {
        console.log('🧹 Cleaning up Vapi instance due to error')
        try {
          await vapiRef.current.stop()
        } catch (cleanupError) {
          console.error('❌ Error during cleanup:', cleanupError)
        }
        vapiRef.current = null
      }
      isInitialized.current = false
      
      setState(prev => ({ ...prev, error: errorMessage }))
      onError?.(errorMessage)
    }
  }, [publicApiKey, onCallStart, onCallEnd, onTranscript, onError])

  // Start a call
  const startCall = useCallback(async () => {
    console.log('🚀 startCall function called')
    console.log('🎯 Target assistant ID:', assistantId)
    console.log('🔍 Vapi instance exists:', !!vapiRef.current)
    
    if (!vapiRef.current) {
      console.log('🔄 Vapi not initialized, calling initializeVapi...')
      await initializeVapi()
    }

    if (!vapiRef.current) {
      console.error('❌ Vapi still not initialized after initialization attempt')
      throw new Error('Vapi not initialized')
    }

    try {
      console.log('📊 Setting call status to connecting...')
      setState(prev => ({ ...prev, callStatus: 'connecting', error: null }))
      console.log('✅ Call status set to connecting')
      
      console.log('🎯 Calling vapi.start() with assistant ID:', assistantId)
      console.log('🔍 Vapi instance methods:', Object.getOwnPropertyNames(vapiRef.current))
      
      const result = await vapiRef.current.start(assistantId)
      console.log('✅ vapi.start() completed successfully')
      console.log('📊 Start result:', result)
      
    } catch (error) {
      console.error('❌ Failed to start call')
      console.error('❌ Error type:', error?.constructor?.name)
      console.error('❌ Error message:', (error as any)?.message)
      console.error('❌ Error stack:', (error as any)?.stack)
      console.error('❌ Full error object:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to start call'
      console.log('📝 Setting error state with message:', errorMessage)
      
      setState(prev => ({
        ...prev,
        callStatus: 'error',
        error: errorMessage
      }))
      
      console.log('📞 Calling onError callback')
      onError?.(errorMessage)
      throw error
    }
  }, [assistantId, initializeVapi, onError])

  // End the current call
  const endCall = useCallback(async () => {
    if (!vapiRef.current || !state.isCallActive) return

    try {
      setState(prev => ({ ...prev, callStatus: 'ending' }))
      console.log('🛑 Ending call')
      
      await vapiRef.current.stop()
      
      setState(prev => ({
        ...prev,
        callStatus: 'idle',
        isCallActive: false,
        callId: null
      }))

    } catch (error) {
      console.error('❌ Error ending call:', error)
      // Still reset state even if stop fails
      setState(prev => ({
        ...prev,
        callStatus: 'idle',
        isCallActive: false,
        callId: null
      }))
    }
  }, [state.isCallActive])

  // Toggle mute - Vapi web SDK doesn't have direct mute methods
  const toggleMute = useCallback(() => {
    // For now, just toggle the local state
    // In a real implementation, you might need to handle this differently
    setState(prev => ({ ...prev, isMuted: !prev.isMuted }))
    console.log('🔇 Mute toggled:', !state.isMuted)
  }, [state.isMuted])

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Reset state
  const reset = useCallback(() => {
    setState({
      isCallActive: false,
      isMuted: false,
      callId: null,
      callStatus: 'idle',
      error: null,
      messages: [],
      currentPartialTranscript: { role: null, text: '' }
    })
  }, [])

  // Initialize on mount
  useEffect(() => {
    console.log('🔄 useEffect triggered - initializing Vapi')
    initializeVapi()
    
    return () => {
      console.log('🧹 Cleanup function called')
      // Cleanup
      if (vapiRef.current) {
        console.log('🛑 Stopping Vapi instance during cleanup')
        try {
          vapiRef.current.stop()
          console.log('✅ Vapi stopped successfully during cleanup')
        } catch (error) {
          console.error('❌ Error stopping Vapi during cleanup:', error)
        }
      }
      
      // Clear any pending timeout
      if (partialTranscriptTimeoutRef.current) {
        clearTimeout(partialTranscriptTimeoutRef.current)
        partialTranscriptTimeoutRef.current = null
      }
    }
  }, []) // Remove initializeVapi dependency to prevent re-initialization

  return {
    ...state,
    startCall,
    endCall,
    toggleMute,
    clearError,
    reset,
    isInitialized: isInitialized.current
  }
} 