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

export interface UsageData {
  llm_prompt_tokens?: number;
  llm_completion_tokens?: number;
  tts_characters?: number;
  stt_audio_duration?: number;
}

export interface CostResult {
  total_llm_cost_inr: number;
  total_tts_cost_inr: number;
  total_stt_cost_inr: number;
}

export interface TranscriptItem {
  role?: 'user' | 'assistant';
  content?: string | string[];
  user_transcript?: string;
  agent_response?: string;
}

export interface MetricsData {
  duration?: number;
  ttft?: number;
  ttfb?: number;
  end_of_utterance_delay?: number;
}

export interface TranscriptWithMetrics {
  turn_id?: string;
  user_transcript?: string;
  agent_response?: string;
  stt_metrics?: MetricsData;
  llm_metrics?: MetricsData;
  tts_metrics?: MetricsData;
  eou_metrics?: MetricsData;
  timestamp?: number;
}

export interface TelemetryPerformanceMetrics {
  total_spans?: number;
  [key: string]: any;
}

export interface TelemetrySpanSummary {
  by_operation?: Record<string, number>;
  critical_path?: Array<{ duration_ms?: number; name?: string; operation_type?: string }>;
  [key: string]: any;
}

export interface TelemetrySpan {
  span_id?: string;
  trace_id?: string;
  name?: string;
  operation_type?: string;
  start_time_ns?: number;
  end_time_ns?: number;
  duration_ms?: number;
  duration_ns?: number;
  status?: Record<string, any>;
  attributes?: Record<string, any>;
  events?: any;
  metadata?: any;
  request_id?: string;
  parent_span_id?: string;
  captured_at?: number; // epoch seconds
  context?: Record<string, any>;
  request_id_source?: string;
}

export interface TelemetryData {
  performance_metrics?: TelemetryPerformanceMetrics;
  span_summary?: TelemetrySpanSummary;
  session_traces?: TelemetrySpan[];
  [key: string]: any;
}

export interface TelemetryAnalyticsSummary {
  total_duration_ms: number;
  bottlenecks: Array<{ operation?: string; type?: string; duration_ms?: number }>;
  avg_step_duration: number;
}

export interface TelemetryAnalytics {
  session_performance: TelemetryPerformanceMetrics;
  operation_breakdown: Record<string, number>;
  critical_path_latency: TelemetryAnalyticsSummary;
  anomaly_detection: any[];
  turn_level_metrics: Record<string, any>;
}

export interface CallLogRequest {
  call_id: string;
  customer_number?: string;
  agent_id?: string;
  call_ended_reason?: string;
  transcript_type?: string;
  transcript_json?: TranscriptItem[];
  metadata?: {
    usage?: UsageData | UsageData[];
    lesson_day?: number;
    lesson_completed?: boolean;
    [key: string]: any;
  };
  dynamic_variables?: Record<string, any>;
  call_started_at?: string;
  call_ended_at?: string;
  duration_seconds?: number;
  transcript_with_metrics?: TranscriptWithMetrics[];
  recording_url?: string;
  voice_recording_url?: string;
  telemetry_data?: TelemetryData;
  environment?: string;
}

export interface FailureReportRequest {
  token: string;
  call_id: string;
  error_message: string;
  error_type?: string;
  stack_trace?: string;
  environment?: string;
}

export interface TokenVerificationResult {
  valid: boolean;
  error?: string;
  token?: any;
  project_id?: string;
  source?: 'new_system' | 'old_system';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
  timestamp: string;
}

export interface FieldExtractorConfig {
  key: string;
  description: string;
}

export interface ProcessTranscriptParams {
  log_id: string;
  transcript_json: TranscriptItem[];
  agent_id: string;
  field_extractor_prompt: string;
}

export interface ProcessTranscriptResult {
  success: boolean;
  status?: string;
  log_id?: string;
  logData?: Record<string, string>;
  error?: string;
}
