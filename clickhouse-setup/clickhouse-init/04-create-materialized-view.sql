USE voice_analytics;

-- =============================================
-- 5. COST CALCULATION MATERIALIZED VIEWS
-- =============================================

-- Update session costs when turns are added
CREATE MATERIALIZED VIEW session_cost_updater_mv TO sessions AS
SELECT 
    session_id,
    any(project_id) as project_id,
    any(phone_number) as phone_number,
    any(user_identifier) as user_identifier,
    min(timestamp_start) as session_start_timestamp,
    max(timestamp_end) as session_end_timestamp,
    
    -- Session status logic
    multiIf(
        countIf(error_occurred) > 0, 'failed',
        max(timestamp_end) IS NOT NULL AND max(timestamp_end) < now() - INTERVAL 2 MINUTE, 'completed',
        'active'
    ) as session_status,
    
    -- Core metrics
    count() as total_turns,
    -- Calculate duration in seconds, ensuring Float32 output
    toFloat32(dateDiff('second', min(timestamp_start), max(timestamp_end))) as total_duration_seconds,
    
    -- Latency aggregations
    avg(total_turn_latency_ms) as avg_turn_latency_ms,
    quantile(0.5)(total_turn_latency_ms) as median_turn_latency_ms,
    max(total_turn_latency_ms) as max_turn_latency_ms,
    min(total_turn_latency_ms) as min_turn_latency_ms,
    quantile(0.95)(total_turn_latency_ms) as p95_turn_latency_ms,
    quantile(0.99)(total_turn_latency_ms) as p99_turn_latency_ms,
    
    -- Component latencies
    avg(stt_latency_ms) as avg_stt_latency_ms,
    avg(llm_latency_ms) as avg_llm_latency_ms,
    avg(tts_latency_ms) as avg_tts_latency_ms,
    avg(total_turn_latency_ms) as avg_total_pipeline_latency_ms,
    
    -- Quality metrics
    avg(response_quality_score) as avg_response_quality_score,
    
    -- =================================================
    -- COST AGGREGATIONS
    -- =================================================
    
    -- Token/usage totals
    sum(llm_input_tokens) as total_input_tokens,
    sum(llm_output_tokens) as total_output_tokens,
    sum(tts_characters) as total_tts_characters,
    sum(stt_audio_duration_seconds) as total_stt_seconds,
    
    -- Cost breakdowns
    sum(stt_turn_cost_usd) as total_stt_cost_usd,
    sum(llm_turn_cost_usd) as total_llm_cost_usd,
    sum(tts_turn_cost_usd) as total_tts_cost_usd,
    sum(compute_cost_usd + network_cost_usd + storage_cost_usd) as total_infrastructure_cost_usd,
    sum(total_turn_cost_usd) as total_session_cost_usd,
    
    -- Model usage (most common models)
    any(stt_model_name) as primary_stt_model,
    any(llm_model_name) as primary_llm_model,
    any(tts_model_name) as primary_tts_model,
    
    -- Cost efficiency
    if(count() > 0, sum(total_turn_cost_usd) / count(), 0) as cost_per_turn_usd,
    if(total_duration_seconds > 0, sum(total_turn_cost_usd) / total_duration_seconds * 60, 0) as cost_per_minute_usd,
    if(sum(total_turn_cost_usd) > 0, (sum(llm_input_tokens) + sum(llm_output_tokens)) / sum(total_turn_cost_usd), 0) as tokens_per_dollar,
    
    -- Other metrics
    any(language_detected) as primary_language,
    countIf(error_occurred) as total_errors,
    sum(retry_count) as total_retries,
    countIf(user_interruption) as total_interruptions
FROM session_logs
GROUP BY session_id;

-- =============================================
-- 6. COST ANALYTICS VIEWS
-- =============================================

-- Hourly cost breakdown
CREATE MATERIALIZED VIEW cost_analytics_hourly_mv
ENGINE = SummingMergeTree()
PARTITION BY (project_id, toYYYYMM(hour_start))
ORDER BY (project_id, hour_start)
AS SELECT
    project_id,
    toStartOfHour(timestamp_start) as hour_start,
    
    -- Volume metrics
    count() as total_turns,
    uniq(session_id) as unique_sessions,
    
    -- Cost breakdowns
    sum(stt_turn_cost_usd) as total_stt_cost,
    sum(llm_turn_cost_usd) as total_llm_cost,
    sum(tts_turn_cost_usd) as total_tts_cost,
    sum(compute_cost_usd) as total_compute_cost,
    sum(network_cost_usd) as total_network_cost,
    sum(storage_cost_usd) as total_storage_cost,
    sum(total_turn_cost_usd) as total_cost,
    
    -- Usage metrics
    sum(llm_input_tokens) as total_input_tokens,
    sum(llm_output_tokens) as total_output_tokens,
    sum(tts_characters) as total_tts_characters,
    sum(stt_audio_duration_seconds) as total_stt_seconds,
    
    -- Model usage
    topK(3)(stt_model_name) as top_stt_models,
    topK(3)(llm_model_name) as top_llm_models,
    topK(3)(tts_model_name) as top_tts_models,
    
    -- Provider breakdown
    sumIf(total_turn_cost_usd, stt_provider = 'openai') as openai_stt_cost,
    sumIf(total_turn_cost_usd, llm_provider = 'openai') as openai_llm_cost,
    sumIf(total_turn_cost_usd, tts_provider = 'openai') as openai_tts_cost,
    sumIf(total_turn_cost_usd, llm_provider = 'anthropic') as anthropic_cost,
    sumIf(total_turn_cost_usd, stt_provider = 'google') as google_stt_cost,
    
    -- Efficiency metrics
    avg(total_turn_cost_usd) as avg_cost_per_turn,
    if(sum(llm_input_tokens + llm_output_tokens) > 0, sum(total_turn_cost_usd) / sum(llm_input_tokens + llm_output_tokens) * 1000, 0) as cost_per_1k_tokens,
    
    -- Performance vs cost
    avg(total_turn_latency_ms) as avg_latency,
    if(avg(total_turn_latency_ms) > 0, sum(total_turn_cost_usd) / avg(total_turn_latency_ms) * 1000, 0) as cost_per_latency_ms
FROM session_logs
WHERE total_turn_cost_usd > 0
GROUP BY project_id, hour_start;

-- Model performance and cost comparison (This is a regular VIEW, not MATERIALIZED)
CREATE VIEW model_performance_analysis AS
SELECT 
    llm_provider,
    llm_model_name,
    count() as usage_count,
    
    -- Performance metrics
    avg(llm_latency_ms) as avg_latency_ms,
    quantile(0.95)(llm_latency_ms) as p95_latency_ms,
    avg(llm_first_token_latency_ms) as avg_first_token_latency_ms,
    
    -- Cost metrics
    avg(llm_turn_cost_usd) as avg_cost_per_turn,
    avg(llm_input_cost_per_token * 1000) as avg_input_cost_per_1k_tokens,
    avg(llm_output_cost_per_token * 1000) as avg_output_cost_per_1k_tokens,
    
    -- Efficiency metrics
    if(avg(llm_turn_cost_usd) > 0, avg(llm_output_tokens) / avg(llm_turn_cost_usd), 0) as tokens_per_dollar,
    if(avg(llm_turn_cost_usd) > 0, avg(llm_latency_ms) / avg(llm_turn_cost_usd), 0) as latency_per_dollar,
    
    -- Quality metrics
    avg(response_quality_score) as avg_quality_score,
    countIf(error_occurred) / count() * 100 as error_rate_percent,
    
    -- Usage patterns
    countIf(timestamp_start >= today()) as usage_today,
    countIf(timestamp_start >= today() - 7) as usage_last_7d,
    max(timestamp_start) as last_used
FROM session_logs
WHERE llm_model_name != '' 
  AND timestamp_start >= now() - INTERVAL 30 DAY
GROUP BY llm_provider, llm_model_name
ORDER BY usage_count DESC;