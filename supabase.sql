-- Supabase Setup Script for Voice Analytics Platform
-- Run this in your Supabase SQL Editor to create all required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Voice Projects Table
CREATE TABLE IF NOT EXISTS pype_voice_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    description TEXT,
    environment VARCHAR DEFAULT 'dev',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    retry_configuration JSONB DEFAULT '{}',
    token_hash TEXT UNIQUE
);

-- Voice Agents Table
CREATE TABLE IF NOT EXISTS pype_voice_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    agent_type VARCHAR NOT NULL,
    configuration JSONB DEFAULT '{}',
    environment VARCHAR DEFAULT 'dev',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    user_id UUID, -- References auth.users if needed
    field_extractor BOOLEAN DEFAULT false,
    field_extractor_prompt TEXT,
    field_extractor_keys JSONB DEFAULT '[]'
);

-- Voice Call Logs Table (Main operational data)
CREATE TABLE IF NOT EXISTS pype_voice_call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id VARCHAR UNIQUE NOT NULL,
    agent_id UUID REFERENCES pype_voice_agents(id) ON DELETE CASCADE,
    customer_number VARCHAR,
    call_ended_reason VARCHAR,
    transcript_type VARCHAR,
    transcript_json JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    dynamic_variables JSONB DEFAULT '{}',
    environment VARCHAR DEFAULT 'dev',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    call_started_at TIMESTAMP WITH TIME ZONE,
    call_ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    recording_url TEXT,
    voice_recording_url TEXT,
    avg_latency FLOAT,
    transcription_metrics JSONB DEFAULT '{}'
);

-- Voice Metrics Logs Table (Analytics data - will also sync to ClickHouse)
CREATE TABLE IF NOT EXISTS pype_voice_metrics_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES pype_voice_call_logs(id) ON DELETE CASCADE,
    turn_id TEXT NOT NULL,
    user_transcript TEXT,
    agent_response TEXT,
    stt_metrics JSONB DEFAULT '{}',
    llm_metrics JSONB DEFAULT '{}',
    tts_metrics JSONB DEFAULT '{}',
    eou_metrics JSONB DEFAULT '{}',
    lesson_day INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unix_timestamp NUMERIC,
    phone_number TEXT,
    call_duration NUMERIC,
    call_success BOOLEAN DEFAULT false,
    lesson_completed BOOLEAN DEFAULT false
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_id ON pype_voice_call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON pype_voice_call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_environment ON pype_voice_call_logs(environment);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_id ON pype_voice_call_logs(call_id);

CREATE INDEX IF NOT EXISTS idx_agents_project_id ON pype_voice_agents(project_id);
CREATE INDEX IF NOT EXISTS idx_agents_environment ON pype_voice_agents(environment);

CREATE INDEX IF NOT EXISTS idx_metrics_session_id ON pype_voice_metrics_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON pype_voice_metrics_logs(created_at);

CREATE MATERIALIZED VIEW call_summary_materialized AS
SELECT 
  agent_id,
  DATE(created_at) as call_date,
  COUNT(*) as calls,
  SUM(duration_seconds) as total_seconds,
  ROUND(SUM(duration_seconds)::numeric / 60, 0) as total_minutes,
  AVG(avg_latency) as avg_latency,
  COUNT(DISTINCT call_id) as unique_customers,
  -- Count successful calls using both conditions
  COUNT(*) FILTER (
    WHERE call_ended_reason = 'completed' 
  ) as successful_calls,
  -- Pre-calculate success rate
  ROUND(
    (COUNT(*) FILTER (
      WHERE call_ended_reason = 'completed' 
    )::numeric / COUNT(*)) * 100, 
    2
  ) as success_rate
FROM pype_voice_call_logs
GROUP BY agent_id, DATE(created_at);


CREATE INDEX idx_call_summary_agent_date ON call_summary_materialized(agent_id, call_date);

CREATE UNIQUE INDEX idx_call_summary_unique
ON call_summary_materialized(agent_id, call_date);



CREATE OR REPLACE FUNCTION refresh_call_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY call_summary_materialized;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;