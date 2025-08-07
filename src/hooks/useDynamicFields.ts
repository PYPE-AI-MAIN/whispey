import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface DynamicFields {
  metadataFields: string[]
  transcriptionFields: string[]
  loading: boolean
  error: string | null
}

export const useDynamicFields = (agentId: string, limit: number = 100): DynamicFields => {
  const [metadataFields, setMetadataFields] = useState<string[]>([])
  const [transcriptionFields, setTranscriptionFields] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!agentId) return

    const extractDynamicFields = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch recent call logs to extract dynamic fields
        const { data: calls, error: fetchError } = await supabase
          .from('pype_voice_call_logs')
          .select('metadata, transcription_metrics')
          .eq('agent_id', agentId)
          .not('metadata', 'is', null)
          .not('transcription_metrics', 'is', null)
          .limit(limit)
          .order('created_at', { ascending: false })

        if (fetchError) {
          throw fetchError
        }

        if (!calls || calls.length === 0) {
          setMetadataFields([])
          setTranscriptionFields([])
          return
        }

        // Extract all unique keys from metadata
        const metadataKeysSet = new Set<string>()
        const transcriptionKeysSet = new Set<string>()

        calls.forEach((call: any) => {
          // Extract metadata keys
          if (call.metadata && typeof call.metadata === 'object') {
            Object.keys(call.metadata).forEach(key => {
              if (key && typeof key === 'string') {
                metadataKeysSet.add(key)
              }
            })
          }

          // Extract transcription_metrics keys
          if (call.transcription_metrics && typeof call.transcription_metrics === 'object') {
            Object.keys(call.transcription_metrics).forEach(key => {
              if (key && typeof key === 'string') {
                transcriptionKeysSet.add(key)
              }
            })
          }
        })

        // Convert to sorted arrays
        const sortedMetadataFields = Array.from(metadataKeysSet).sort()
        const sortedTranscriptionFields = Array.from(transcriptionKeysSet).sort()

        setMetadataFields(sortedMetadataFields)
        setTranscriptionFields(sortedTranscriptionFields)

      } catch (err) {
        console.error('Error extracting dynamic fields:', err)
        setError('Failed to load dynamic fields')
      } finally {
        setLoading(false)
      }
    }

    extractDynamicFields()
  }, [agentId, limit])

  return {
    metadataFields,
    transcriptionFields,
    loading,
    error
  }
}