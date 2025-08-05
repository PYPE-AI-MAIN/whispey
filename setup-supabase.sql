create table public.pype_voice_metrics_logs (
    id uuid primary key default gen_random_uuid(),
    session_id uuid,
    turn_id text,
    user_transcript text,
    agent_response text,
    stt_metrics jsonb,
    llm_metrics jsonb,
    tts_metrics jsonb,
    eou_metrics jsonb,
    lesson_day int4,
    created_at timestamp with time zone default now(),
    unix_timestamp numeric,
    phone_number text,
    call_duration numeric,
    call_success boolean,
    lesson_completed boolean
);


create table public.pype_voice_call_logs (
    id uuid primary key default gen_random_uuid(),
    call_id varchar,
    agent_id uuid,
    customer_number varchar,
    call_ended_reason varchar,
    transcript_type varchar,
    transcript_json jsonb,
    metadata jsonb,
    dynamic_variables jsonb,
    environment varchar,
    created_at timestamp with time zone default now(),
    call_started_at timestamp with time zone,
    call_ended_at timestamp with time zone,
    duration_seconds int4,
    recording_url text,
    avg_latency float8,
    transcription_metrics jsonb,
    total_stt_cost float8,
    total_tts_cost float8,
    total_llm_cost float8
);


create table public.pype_voice_agents (
    id uuid primary key default gen_random_uuid(),
    project_id uuid,
    name varchar,
    agent_type varchar,
    configuration jsonb,
    environment varchar,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone,
    is_active boolean default true,
    user_id uuid,
    field_extractor boolean,
    field_extractor_prompt text,
    field_extractor_keys jsonb
);


create table public.pype_voice_projects (
    id uuid primary key default gen_random_uuid(),
    name varchar,
    description text,
    environment varchar,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone,
    is_active boolean default true,
    retry_configuration jsonb,
    token_hash text,
    owner_clerk_id text,
    campaign_config jsonb
);

create table public.pype_voice_email_project_mapping (
    id serial primary key,
    email text,
    project_id uuid,
    role text,
    permissions jsonb,
    added_by_clerk_id text,
    created_at timestamp with time zone default now(),
    clerk_id text,
    is_active boolean default true
);

create table public.pype_voice_agent_call_log_views (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid,
    name text,
    filters jsonb,
    visible_columns jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone
);

create table public.audio_api_pricing (
    service_type text,
    provider text,
    model_or_plan text,
    unit text,
    cost_usd_per_unit numeric,
    valid_from date,
    source_url text
);

create table public.gpt_api_pricing (
    model_name text,
    input_usd_per_million numeric,
    output_usd_per_million numeric,
    created_at timestamp with time zone default now()
);

create table public.gpt_api_pricing_inr (
    model_name text,
    input_inr_per_million numeric,
    output_inr_per_million numeric,
    rate_date date,
    created_at timestamp with time zone default now()
);

create table public.pype_voice_users (
    id uuid primary key default gen_random_uuid(),
    email text,
    first_name text,
    last_name text,
    profile_image_url text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone,
    clerk_id text,
    is_active boolean default true
);

create table public.usd_to_inr_rate (
    as_of date,
    rate numeric,
    source text
);


CREATE MATERIALIZED VIEW call_summary_materialized AS
SELECT
  agent_id,
  DATE(created_at) AS call_date,

  COUNT(*) AS calls,
  SUM(duration_seconds) AS total_seconds,
  ROUND(SUM(duration_seconds)::numeric / 60, 0) AS total_minutes,
  AVG(avg_latency) AS avg_latency,
  COUNT(DISTINCT call_id) AS unique_customers,
  COUNT(*) FILTER (WHERE call_ended_reason = 'completed') AS successful_calls,
  ROUND(
    (COUNT(*) FILTER (WHERE call_ended_reason = 'completed')::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS success_rate,

  -- Telecom cost only for completed calls (₹ 0.70 per started minute)
  SUM(
    CEIL(duration_seconds::numeric / 60)
  ) FILTER (WHERE call_ended_reason = 'completed') * 0.70 AS telecom_cost,

  -- Total LLM+TTS+STT cost only for completed calls
  (
    COALESCE(SUM(total_llm_cost) FILTER (WHERE call_ended_reason = 'completed'), 0)
    + COALESCE(SUM(total_tts_cost) FILTER (WHERE call_ended_reason = 'completed'), 0)
    + COALESCE(SUM(total_stt_cost) FILTER (WHERE call_ended_reason = 'completed'), 0)
    + SUM(CEIL(duration_seconds::numeric / 60)) FILTER (WHERE call_ended_reason = 'completed') * 0.70
  )::numeric(16, 2) AS total_cost

FROM pype_voice_call_logs
GROUP BY agent_id, DATE(created_at);

CREATE UNIQUE INDEX call_summary_agent_date_idx
  ON call_summary_materialized (agent_id, call_date);


REFRESH MATERIALIZED VIEW CONCURRENTLY call_summary_materialized;