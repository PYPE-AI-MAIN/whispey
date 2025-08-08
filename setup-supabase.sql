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


-- Drop and recreate with corrected COUNT logic
DROP FUNCTION IF EXISTS calculate_custom_total(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS build_single_filter_condition(JSONB);

CREATE OR REPLACE FUNCTION calculate_custom_total(
  p_agent_id UUID,
  p_aggregation TEXT,
  p_column_name TEXT,
  p_json_field TEXT DEFAULT NULL,
  p_filters JSONB DEFAULT '[]'::jsonb,
  p_filter_logic TEXT DEFAULT 'AND',
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(
  result NUMERIC,
  error_message TEXT
) AS $$
DECLARE
  base_query TEXT;
  where_conditions TEXT[] := ARRAY[]::TEXT[];
  filter_conditions TEXT[] := ARRAY[]::TEXT[];
  final_where TEXT := '';
  result_value NUMERIC := 0;
  error_msg TEXT := NULL;
  rec RECORD;
  filter_item JSONB;
  filter_condition TEXT;
BEGIN
  -- Normalize p_json_field
  IF p_json_field = '' OR p_json_field = 'null' THEN
    p_json_field := NULL;
  END IF;

  -- Build base query - FIXED LOGIC
  IF p_aggregation = 'COUNT' THEN
    -- For COUNT, don't add JSON field restrictions to base query
    -- Let the filters handle the specific conditions
    base_query := 'SELECT COUNT(*) as result FROM pype_voice_call_logs WHERE agent_id = $1';
    
  ELSIF p_aggregation = 'COUNT_DISTINCT' THEN
    IF p_json_field IS NOT NULL THEN
      -- Only for COUNT_DISTINCT do we need to ensure the field exists for the DISTINCT operation
      base_query := 'SELECT COUNT(DISTINCT (' || quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ')) as result FROM pype_voice_call_logs WHERE agent_id = $1 AND ' || 
                   quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ' IS NOT NULL AND ' ||
                   quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ' != ''''';
    ELSE
      base_query := 'SELECT COUNT(DISTINCT ' || quote_ident(p_column_name) || ') as result FROM pype_voice_call_logs WHERE agent_id = $1 AND ' || quote_ident(p_column_name) || ' IS NOT NULL';
    END IF;
    
  ELSIF p_aggregation = 'SUM' THEN
    IF p_json_field IS NOT NULL THEN
      base_query := 'SELECT COALESCE(SUM(CASE WHEN ' || quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ' ~ ''^-?[0-9]+\.?[0-9]*$'' THEN (' || quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ')::NUMERIC ELSE 0 END), 0) as result FROM pype_voice_call_logs WHERE agent_id = $1';
    ELSE
      base_query := 'SELECT COALESCE(SUM(' || quote_ident(p_column_name) || '), 0) as result FROM pype_voice_call_logs WHERE agent_id = $1';
    END IF;
    
  ELSIF p_aggregation = 'AVG' THEN
    IF p_json_field IS NOT NULL THEN
      base_query := 'SELECT COALESCE(AVG(CASE WHEN ' || quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ' ~ ''^-?[0-9]+\.?[0-9]*$'' THEN (' || quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ')::NUMERIC ELSE NULL END), 0) as result FROM pype_voice_call_logs WHERE agent_id = $1';
    ELSE
      base_query := 'SELECT COALESCE(AVG(' || quote_ident(p_column_name) || '), 0) as result FROM pype_voice_call_logs WHERE agent_id = $1';
    END IF;
    
  ELSIF p_aggregation = 'MIN' THEN
    IF p_json_field IS NOT NULL THEN
      base_query := 'SELECT COALESCE(MIN(CASE WHEN ' || quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ' ~ ''^-?[0-9]+\.?[0-9]*$'' THEN (' || quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ')::NUMERIC ELSE NULL END), 0) as result FROM pype_voice_call_logs WHERE agent_id = $1';
    ELSE
      base_query := 'SELECT COALESCE(MIN(' || quote_ident(p_column_name) || '), 0) as result FROM pype_voice_call_logs WHERE agent_id = $1';
    END IF;
    
  ELSIF p_aggregation = 'MAX' THEN
    IF p_json_field IS NOT NULL THEN
      base_query := 'SELECT COALESCE(MAX(CASE WHEN ' || quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ' ~ ''^-?[0-9]+\.?[0-9]*$'' THEN (' || quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ')::NUMERIC ELSE NULL END), 0) as result FROM pype_voice_call_logs WHERE agent_id = $1';
    ELSE
      base_query := 'SELECT COALESCE(MAX(' || quote_ident(p_column_name) || '), 0) as result FROM pype_voice_call_logs WHERE agent_id = $1';
    END IF;
    
  ELSE
    error_msg := 'Unsupported aggregation type: ' || p_aggregation;
    RETURN QUERY SELECT NULL::NUMERIC, error_msg;
    RETURN;
  END IF;

  -- Add date range conditions to where_conditions (these are always AND)
  IF p_date_from IS NOT NULL THEN
    where_conditions := array_append(where_conditions, 
      'call_started_at >= ' || quote_literal(p_date_from || ' 00:00:00'));
  END IF;
  
  IF p_date_to IS NOT NULL THEN
    where_conditions := array_append(where_conditions, 
      'call_started_at <= ' || quote_literal(p_date_to || ' 23:59:59.999'));
  END IF;

  -- IMPORTANT: For COUNT operations with JSON fields, add the field existence check as a filter
  -- This ensures we only count records where the field exists
  IF p_aggregation = 'COUNT' AND p_json_field IS NOT NULL THEN
    where_conditions := array_append(where_conditions,
      quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ' IS NOT NULL AND ' ||
      quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ' != ''''');
  END IF;

  -- Process custom filters separately
  FOR filter_item IN SELECT * FROM jsonb_array_elements(p_filters)
  LOOP
    filter_condition := build_single_filter_condition(filter_item);
    IF filter_condition IS NOT NULL AND filter_condition != '' THEN
      filter_conditions := array_append(filter_conditions, filter_condition);
    END IF;
  END LOOP;

  -- Build final WHERE clause
  -- First add the basic where conditions (agent_id, dates, field existence, etc.)
  final_where := '';
  IF array_length(where_conditions, 1) > 0 THEN
    final_where := ' AND ' || array_to_string(where_conditions, ' AND ');
  END IF;

  -- Then add the custom filter conditions with proper logic
  IF array_length(filter_conditions, 1) > 0 THEN
    IF p_filter_logic = 'OR' THEN
      -- All custom filters joined with OR
      final_where := final_where || ' AND (' || array_to_string(filter_conditions, ' OR ') || ')';
    ELSE
      -- All custom filters joined with AND (default)
      final_where := final_where || ' AND (' || array_to_string(filter_conditions, ' AND ') || ')';
    END IF;
  END IF;

  -- Add the WHERE clause to the base query
  base_query := base_query || final_where;

  -- Debug logging
  RAISE NOTICE 'Final query: %', base_query;
  RAISE NOTICE 'Filter conditions: %', filter_conditions;
  RAISE NOTICE 'Where conditions: %', where_conditions;
  RAISE NOTICE 'Filter logic: %', p_filter_logic;

  -- Execute the query
  BEGIN
    EXECUTE base_query INTO rec USING p_agent_id;
    result_value := rec.result;
    RETURN QUERY SELECT COALESCE(result_value, 0), error_msg;
  EXCEPTION WHEN OTHERS THEN
    error_msg := 'Query execution error: ' || SQLERRM || ' | Query: ' || base_query;
    RETURN QUERY SELECT NULL::NUMERIC, error_msg;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to build individual filter conditions (unchanged)
CREATE OR REPLACE FUNCTION build_single_filter_condition(filter_obj JSONB)
RETURNS TEXT AS $$
DECLARE
  column_name TEXT;
  json_field TEXT;
  operation TEXT;
  filter_value TEXT;
  condition TEXT := '';
BEGIN
  -- Extract filter properties
  column_name := filter_obj->>'column';
  json_field := filter_obj->>'jsonField';
  operation := filter_obj->>'operation';
  filter_value := filter_obj->>'value';

  -- Normalize empty strings to NULL
  IF json_field = '' OR json_field = 'null' THEN
    json_field := NULL;
  END IF;

  -- Validate required fields
  IF column_name IS NULL OR operation IS NULL THEN
    RETURN '';
  END IF;

  -- Build condition based on operation
  CASE operation
    WHEN 'equals', 'json_equals' THEN
      IF json_field IS NOT NULL THEN
        condition := quote_ident(column_name) || '->>' || quote_literal(json_field) || ' = ' || quote_literal(filter_value);
      ELSE
        condition := quote_ident(column_name) || ' = ' || quote_literal(filter_value);
      END IF;
    
    WHEN 'contains', 'json_contains' THEN
      IF json_field IS NOT NULL THEN
        condition := quote_ident(column_name) || '->>' || quote_literal(json_field) || ' ILIKE ' || quote_literal('%' || filter_value || '%');
      ELSE
        condition := quote_ident(column_name) || ' ILIKE ' || quote_literal('%' || filter_value || '%');
      END IF;
    
    WHEN 'starts_with' THEN
      IF json_field IS NOT NULL THEN
        condition := quote_ident(column_name) || '->>' || quote_literal(json_field) || ' ILIKE ' || quote_literal(filter_value || '%');
      ELSE
        condition := quote_ident(column_name) || ' ILIKE ' || quote_literal(filter_value || '%');
      END IF;
    
    WHEN 'greater_than', 'json_greater_than' THEN
      IF json_field IS NOT NULL THEN
        condition := '(' || quote_ident(column_name) || '->>' || quote_literal(json_field) || ')::NUMERIC > ' || quote_literal(filter_value) || '::NUMERIC';
      ELSE
        condition := quote_ident(column_name) || ' > ' || quote_literal(filter_value) || '::NUMERIC';
      END IF;
    
    WHEN 'less_than', 'json_less_than' THEN
      IF json_field IS NOT NULL THEN
        condition := '(' || quote_ident(column_name) || '->>' || quote_literal(json_field) || ')::NUMERIC < ' || quote_literal(filter_value) || '::NUMERIC';
      ELSE
        condition := quote_ident(column_name) || ' < ' || quote_literal(filter_value) || '::NUMERIC';
      END IF;
    
    WHEN 'json_exists' THEN
      IF json_field IS NOT NULL THEN
        condition := quote_ident(column_name) || '->>' || quote_literal(json_field) || ' IS NOT NULL AND ' ||
                    quote_ident(column_name) || '->>' || quote_literal(json_field) || ' != ''''';
      ELSE
        condition := quote_ident(column_name) || ' IS NOT NULL';
      END IF;
    
    ELSE
      condition := '';
  END CASE;

  -- Debug individual filter conditions
  RAISE NOTICE 'Built filter condition: %', condition;

  RETURN condition;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;