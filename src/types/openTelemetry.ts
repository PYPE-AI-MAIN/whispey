// OpenTelemetry Types for better type safety

export interface SpanStatus {
    code: 'OK' | 'ERROR' | 'UNSET' | number;
    message?: string;
  }
  
  export interface SpanEvent {
    name: string;
    timestamp: number;
    attributes?: Record<string, any>;
  }
  
  export interface SpanLink {
    trace_id: string;
    span_id: string;
    trace_state?: string;
    attributes?: Record<string, any>;
  }
  
  export interface OTelSpan {
    trace_id: string;
    span_id: string;
    parent_span_id?: string;
    name: string;
    kind: 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
    start_time_ns: number;
    end_time_ns: number;
    duration_ns: number;
    status?: SpanStatus;
    attributes?: Record<string, any>;
    events?: SpanEvent[];
    links?: SpanLink[];
    resource?: Record<string, any>;
    scope?: {
      name: string;
      version?: string;
      attributes?: Record<string, any>;
    };
  }
  
  export interface SessionTrace {
    session_id: string;
    trace_id: string;
    total_spans: number;
    spans: OTelSpan[];
    created_at: string;
    updated_at: string;
  }
  
  export type GroupByOption = 'service' | 'operation' | 'none';
  
  export interface SpanTypeInfo {
    icon: React.ReactNode;
    color: string;
    bg: string;
    category: string;
  }
  
  export interface StatusInfo {
    icon: React.ReactNode;
    text: string;
    color: string;
  }
  
  // Common OpenTelemetry semantic conventions
  export const OTEL_ATTRIBUTES = {
    SERVICE_NAME: 'service.name',
    SERVICE_VERSION: 'service.version',
    HTTP_METHOD: 'http.method',
    HTTP_URL: 'http.url',
    HTTP_STATUS_CODE: 'http.status_code',
    DB_SYSTEM: 'db.system',
    DB_NAME: 'db.name',
    DB_OPERATION: 'db.operation',
    ERROR_TYPE: 'error.type',
    ERROR_MESSAGE: 'error.message',
    LLM_REQUEST_TYPE: 'llm.request.type',
    LLM_PROVIDER: 'llm.provider',
    LLM_MODEL: 'llm.model',
    TTS_PROVIDER: 'tts.provider',
    STT_PROVIDER: 'stt.provider',
  } as const;