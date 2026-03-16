// src/lib/adapters/types.ts
// Provider-agnostic normalized call data schema.
// Downstream pipeline (sendToPype, call logs table, field extractor, metrics) never touches provider-specific code.

export interface NormalizedTurn {
  turn_id: number
  user_transcript: string
  agent_response: string
  timestamp: number // unix seconds
  stt_metrics: {
    duration: number    // seconds, 0 if provider doesn't send
    confidence: number  // 0-1, 0.95 default if provider doesn't send
  }
  llm_metrics: {
    ttft: number        // seconds
    total_time: number  // seconds
    tokens: number      // estimated if not provided
  }
  tts_metrics: {
    ttfb: number        // seconds
    duration: number    // seconds
  }
  eou_metrics: {
    end_of_utterance_delay: number // seconds
  }
}

export interface NormalizedCallData {
  call_id: string
  agent_id: string                    // provider's agent/assistant ID
  recording_url: string
  customer_number: string             // E.164 phone or 'web-call-{id}' for web calls
  transcript_with_metrics: NormalizedTurn[]
  call_ended_reason: string           // normalized: 'completed' | 'timeout' | 'error'
  environment: 'dev' | 'staging' | 'prod'
  metadata: {
    total_cost: number
    total_duration_seconds: number
    call_started_at: string           // ISO string
    call_ended_at: string             // ISO string
    summary: string
    raw_transcript: string
    customer_number: string
    [key: string]: any                // provider-specific extras go here
  }
}

// Every adapter implements this interface. One method, one job.
export interface ICallAdapter<TRawPayload = unknown> {
  /**
   * Returns true if this adapter can handle the given raw payload.
   * Used by the registry to auto-detect provider when needed.
   */
  canHandle(payload: TRawPayload): boolean

  /**
   * Transform raw provider payload → NormalizedCallData.
   * Returns null if the payload should be ignored (e.g. not an end-of-call event).
   */
  transform(payload: TRawPayload, environment: 'dev' | 'staging' | 'prod'): NormalizedCallData | null
}