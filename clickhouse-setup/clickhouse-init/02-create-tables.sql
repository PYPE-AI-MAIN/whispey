-- Use the database created in 01-create-database.sql
USE voice_analytics;

-- =============================================
-- 1. PROJECTS TABLE (Top Level)
-- =============================================

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name String,
    description String,
    environment LowCardinality(String), -- 'dev', 'staging', 'production'
    
    -- Project configuration
    configuration String, -- JSON config (retry settings, models, etc.)
    api_key_hash String,
    
    -- Cost tracking settings
    cost_tracking_enabled Bool DEFAULT true,
    currency LowCardinality(String) DEFAULT 'USD',
    
    -- Timestamps
    created_at DateTime64(3),
    updated_at DateTime64(3),
    is_active Bool DEFAULT true,
    
    -- Aggregated metrics (these will be populated either manually or by separate processes/MVs)
    total_sessions UInt64 DEFAULT 0,        -- Corrected type from AggregateFunction
    total_turns UInt64 DEFAULT 0,           -- Corrected type from AggregateFunction
    total_cost Float32 DEFAULT 0.0,         -- Corrected type from AggregateFunction
    avg_session_latency Float32 DEFAULT 0.0, -- Corrected type from AggregateFunction
    avg_turn_latency Float32 DEFAULT 0.0,    -- Corrected type from AggregateFunction
    last_activity DateTime64(3) DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY id;

-- =============================================
-- 2. SESSIONS TABLE (Conversation Level)
-- =============================================

CREATE TABLE sessions (
    id UUID, -- Removed PRIMARY KEY here, defined explicitly below
    project_id UUID,
    
    -- Core session data
    phone_number String,
    user_identifier String,
    session_start_timestamp DateTime64(3),
    session_end_timestamp Nullable(DateTime64(3)),
    updated_at DateTime64(3) DEFAULT now(), -- ADDED: Non-nullable updated_at column for ReplacingMergeTree
    
    -- Session status
    session_status LowCardinality(String), -- 'active', 'completed', 'failed', 'timeout'
    completion_reason LowCardinality(Nullable(String)), -- CORRECTED: LowCardinality outside Nullable, wrapping it
    
    -- Core metrics (computed from turns)
    total_turns UInt16 DEFAULT 0,
    total_duration_seconds Float32 DEFAULT 0,
    
    -- Latency metrics (aggregated from session_logs)
    avg_turn_latency_ms Float32 DEFAULT 0,
    median_turn_latency_ms Float32 DEFAULT 0,
    max_turn_latency_ms Float32 DEFAULT 0,
    min_turn_latency_ms Float32 DEFAULT 0,
    p95_turn_latency_ms Float32 DEFAULT 0,
    p99_turn_latency_ms Float32 DEFAULT 0,
    
    -- Component latencies (averaged across turns)
    avg_stt_latency_ms Float32 DEFAULT 0,
    avg_llm_latency_ms Float32 DEFAULT 0,
    avg_tts_latency_ms Float32 DEFAULT 0,
    avg_total_pipeline_latency_ms Float32 DEFAULT 0,
    
    -- Quality metrics
    avg_response_quality_score Float32 DEFAULT 0,
    user_satisfaction_score Nullable(Float32),
    
    -- =================================================
    -- DETAILED COST TRACKING (Session Level)
    -- =================================================
    
    -- Token usage totals
    total_input_tokens UInt32 DEFAULT 0,
    total_output_tokens UInt32 DEFAULT 0,
    total_tts_characters UInt32 DEFAULT 0,
    total_stt_seconds Float32 DEFAULT 0, -- Total audio duration processed
    
    -- Cost breakdown by component
    total_stt_cost_usd Float32 DEFAULT 0,
    total_llm_cost_usd Float32 DEFAULT 0,
    total_tts_cost_usd Float32 DEFAULT 0,
    total_infrastructure_cost_usd Float32 DEFAULT 0, -- Compute, network, etc.
    total_session_cost_usd Float32 DEFAULT 0, -- Sum of all above
    
    -- Model usage summary (most used models in this session)
    primary_stt_model String DEFAULT '',
    primary_llm_model String DEFAULT '',
    primary_tts_model String DEFAULT '',
    
    -- Cost efficiency metrics
    cost_per_turn_usd Float32 DEFAULT 0,
    cost_per_minute_usd Float32 DEFAULT 0,
    tokens_per_dollar Float32 DEFAULT 0,
    
    -- Language and content
    primary_language LowCardinality(String) DEFAULT 'unknown',
    
    -- Error tracking
    total_errors UInt16 DEFAULT 0,
    total_retries UInt16 DEFAULT 0,
    total_interruptions UInt16 DEFAULT 0,
    
    -- DYNAMIC METADATA (Business Logic & Custom Fields)
    session_metadata String, -- JSON for all business-specific fields
    
    -- Partitioning fields
    date Date MATERIALIZED toDate(session_start_timestamp),
    hour UInt8 MATERIALIZED toHour(session_start_timestamp)
) ENGINE = ReplacingMergeTree(updated_at) -- CHANGED: Using updated_at as the version column
PARTITION BY (project_id, toYYYYMM(session_start_timestamp))
ORDER BY (project_id, session_start_timestamp, id)
PRIMARY KEY (project_id, session_start_timestamp, id)
SETTINGS index_granularity = 8192;

-- =============================================
-- 3. SESSION_LOGS TABLE (Turn-by-Turn Details)
-- =============================================

CREATE TABLE session_logs (
    -- Primary identifiers
    id UUID,
    session_id UUID,
    project_id UUID,
    turn_number UInt16,
    
    -- Turn metadata
    turn_type LowCardinality(String),
    timestamp_start DateTime64(3),
    timestamp_end DateTime64(3),
    
    -- Content
    user_transcript String,
    agent_response String,
    intent_detected String,
    confidence_score Float32 DEFAULT 0.0,
    
    -- =================================================
    -- DETAILED LATENCY BREAKDOWN
    -- =================================================
    
    -- Speech-to-Text timing
    stt_start_timestamp DateTime64(3),
    stt_end_timestamp DateTime64(3),
    stt_latency_ms Float32 MATERIALIZED dateDiff('millisecond', stt_start_timestamp, stt_end_timestamp),
    stt_processing_time_ms Float32 DEFAULT 0,
    stt_queue_wait_time_ms Float32 DEFAULT 0,
    stt_confidence_score Float32 DEFAULT 0,
    
    -- LLM Processing timing
    llm_start_timestamp DateTime64(3),
    llm_end_timestamp DateTime64(3),
    llm_latency_ms Float32 MATERIALIZED dateDiff('millisecond', llm_start_timestamp, llm_end_timestamp),
    llm_first_token_latency_ms Float32 DEFAULT 0, -- TTFT
    llm_processing_time_ms Float32 DEFAULT 0,
    llm_queue_wait_time_ms Float32 DEFAULT 0,
    
    -- Text-to-Speech timing
    tts_start_timestamp DateTime64(3),
    tts_end_timestamp DateTime64(3),
    tts_latency_ms Float32 MATERIALIZED dateDiff('millisecond', tts_start_timestamp, tts_end_timestamp),
    tts_processing_time_ms Float32 DEFAULT 0,
    tts_queue_wait_time_ms Float32 DEFAULT 0,
    
    -- Overall turn latency
    total_turn_latency_ms Float32 MATERIALIZED dateDiff('millisecond', timestamp_start, timestamp_end),
    
    -- Infrastructure latencies
    network_latency_ms Float32 DEFAULT 0,
    database_latency_ms Float32 DEFAULT 0,
    cache_hit Bool DEFAULT false,
    
    -- =================================================
    -- DETAILED MODEL & COST INFORMATION
    -- =================================================
    
    -- STT Model Information
    stt_model_name String DEFAULT '',
    stt_model_version String DEFAULT '',
    stt_provider LowCardinality(String) DEFAULT '', -- 'openai', 'google', 'azure', 'aws', etc.
    stt_audio_duration_seconds Float32 DEFAULT 0,
    stt_cost_per_second Float32 DEFAULT 0,
    stt_turn_cost_usd Float32 DEFAULT 0,
    
    -- LLM Model Information
    llm_model_name String DEFAULT '',
    llm_model_version String DEFAULT '',
    llm_provider LowCardinality(String) DEFAULT '', -- 'openai', 'anthropic', 'google', etc.
    llm_temperature Float32 DEFAULT 0,
    llm_max_tokens UInt32 DEFAULT 0,
    llm_input_tokens UInt32 DEFAULT 0,
    llm_output_tokens UInt32 DEFAULT 0,
    llm_input_cost_per_token Float32 DEFAULT 0,
    llm_output_cost_per_token Float32 DEFAULT 0,
    llm_turn_cost_usd Float32 DEFAULT 0,
    
    -- TTS Model Information
    tts_model_name String DEFAULT '',
    tts_model_version String DEFAULT '',
    tts_provider LowCardinality(String) DEFAULT '', -- 'openai', 'elevenlabs', 'google', etc.
    tts_voice_id String DEFAULT '',
    tts_voice_name String DEFAULT '',
    tts_characters UInt32 DEFAULT 0,
    tts_cost_per_character Float32 DEFAULT 0,
    tts_turn_cost_usd Float32 DEFAULT 0,
    
    -- Infrastructure costs
    compute_cost_usd Float32 DEFAULT 0, -- GPU/CPU compute cost
    network_cost_usd Float32 DEFAULT 0, -- Data transfer cost
    storage_cost_usd Float32 DEFAULT 0, -- Storage cost for audio/logs
    
    -- Total turn cost
    total_turn_cost_usd Float32 DEFAULT 0, -- Sum of all component costs
    
    -- =================================================
    -- QUALITY & ERROR METRICS
    -- =================================================
    
    response_quality_score Float32 DEFAULT 0,
    user_interruption Bool DEFAULT false,
    error_occurred Bool DEFAULT false,
    error_type LowCardinality(String) DEFAULT '',
    error_message String DEFAULT '',
    retry_count UInt8 DEFAULT 0,
    
    -- Language detection
    language_detected LowCardinality(String) DEFAULT 'unknown',
    
    -- =================================================
    -- DYNAMIC METADATA & RAW DATA
    -- =================================================
    
    turn_metadata String, -- JSON for turn-specific custom fields
    raw_metrics String, -- Combined JSON of all raw metrics
    
    -- Partitioning fields
    date Date MATERIALIZED toDate(timestamp_start),
    hour UInt8 MATERIALIZED toHour(timestamp_start)
) ENGINE = MergeTree()
PARTITION BY (project_id, toYYYYMM(timestamp_start))
ORDER BY (project_id, session_id, turn_number, timestamp_start)
SETTINGS index_granularity = 8192;

-- =============================================
-- 4. MODEL PRICING TABLE (For Dynamic Cost Calculation)
-- =============================================

CREATE TABLE model_pricing (
    id UUID PRIMARY KEY,
    provider LowCardinality(String), -- 'openai', 'anthropic', 'google', etc.
    service_type LowCardinality(String), -- 'stt', 'llm', 'tts'
    model_name String,
    model_version String DEFAULT 'latest',
    
    -- Pricing structure
    pricing_type LowCardinality(String), -- 'per_token', 'per_character', 'per_second', 'per_request'
    
    -- Different pricing tiers
    input_price_per_unit Float32 DEFAULT 0, -- For LLM input tokens
    output_price_per_unit Float32 DEFAULT 0, -- For LLM output tokens
    price_per_unit Float32 DEFAULT 0, -- For STT/TTS
    
    -- Currency and units
    currency LowCardinality(String) DEFAULT 'USD',
    unit_description String, -- '1K tokens', '1 character', '1 second', etc.
    
    -- Metadata
    effective_date DateTime64(3),
    expires_date Nullable(DateTime64(3)),
    is_active Bool DEFAULT true,
    
    -- Additional info
    region LowCardinality(String) DEFAULT 'global',
    tier LowCardinality(String) DEFAULT 'standard', -- 'free', 'standard', 'premium'
    
    created_at DateTime64(3) DEFAULT now(),
    updated_at DateTime64(3) DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (id, provider, service_type, model_name, effective_date)
SETTINGS index_granularity = 8192; -- MOVED: This line was outside the table definition
