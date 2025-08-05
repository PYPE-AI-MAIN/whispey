export interface CallLog {
  id: string
  call_id: string
  agent_id: string
  customer_number: string
  call_ended_reason: string
  transcript_type: string
  transcript_json: any
  metadata: any
  environment: string
  call_started_at: string
  call_ended_at: string
  avg_latency?: number
  recording_url: string
  duration_seconds: number
  created_at: string
  transcription_metrics?: any
  total_llm_cost?: number
  total_tts_cost?: number
  total_stt_cost?: number
  total_cost?:number
}