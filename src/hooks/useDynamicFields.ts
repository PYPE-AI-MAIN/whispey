import { useState, useEffect } from 'react'
import { postSupabaseSelect } from '@/lib/supabase-select-client'

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
        const calls = (await postSupabaseSelect<{
          metadata: unknown
          transcription_metrics: unknown
        }>({
          table: 'pype_voice_call_logs',
          query: {
            select: 'metadata, transcription_metrics',
            filters: [
              { column: 'agent_id', operator: 'eq', value: agentId },
              { column: 'metadata', operator: 'not.is', value: null },
              { column: 'transcription_metrics', operator: 'not.is', value: null },
            ],
            orderBy: { column: 'created_at', ascending: false },
            limit,
          },
          auth: { agentId },
        })) as Array<{ metadata?: unknown; transcription_metrics?: unknown }>

        if (!calls || calls.length === 0) {
          setMetadataFields([])
          setTranscriptionFields([])
          return
        }

        const metadataKeysSet = new Set<string>()
        const transcriptionKeysSet = new Set<string>()

        calls.forEach((call) => {
          if (call.metadata && typeof call.metadata === 'object') {
            Object.keys(call.metadata as object).forEach((key) => {
              if (key && typeof key === 'string') {
                metadataKeysSet.add(key)
              }
            })
          }

          if (call.transcription_metrics && typeof call.transcription_metrics === 'object') {
            Object.keys(call.transcription_metrics as object).forEach((key) => {
              if (key && typeof key === 'string') {
                transcriptionKeysSet.add(key)
              }
            })
          }
        })

        const SENSITIVE_METADATA_KEYS = ['apikey', 'api_url']
        const sortedMetadataFields = Array.from(metadataKeysSet)
          .filter((key) => !SENSITIVE_METADATA_KEYS.includes(key))
          .sort()
        const sortedTranscriptionFields = Array.from(transcriptionKeysSet).sort()

        setMetadataFields(sortedMetadataFields)
        setTranscriptionFields(sortedTranscriptionFields)
      } catch (err) {
        console.error('Error extracting dynamic fields:', err)
        setError(err instanceof Error ? err.message : 'Failed to load fields')
      } finally {
        setLoading(false)
      }
    }

    extractDynamicFields()
  }, [agentId, limit])

  return { metadataFields, transcriptionFields, loading, error }
}
