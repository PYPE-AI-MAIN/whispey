-- Migration: add p_distinct_config parameter to calculate_custom_total
--
-- The TypeScript code passes p_distinct_config (a JSONB object with `column` and
-- optional `jsonField`) so that COUNT aggregations can count distinct values of a
-- specific field instead of plain COUNT(*).
--
-- Run this against your Supabase database (SQL Editor or psql) to fix the error:
--   "Could not find the function public.calculate_custom_total(...p_distinct_config...)"

-- Drop old 8-param overload so CREATE OR REPLACE targets the right signature
DROP FUNCTION IF EXISTS calculate_custom_total(uuid, text, text, text, jsonb, text, date, date) CASCADE;
-- Drop new 9-param overload in case a partial migration already exists
DROP FUNCTION IF EXISTS calculate_custom_total(uuid, text, text, text, jsonb, text, date, date, jsonb) CASCADE;

CREATE OR REPLACE FUNCTION calculate_custom_total(
    p_agent_id UUID,
    p_aggregation TEXT,
    p_column_name TEXT,
    p_json_field TEXT DEFAULT NULL,
    p_filters JSONB DEFAULT '[]'::jsonb,
    p_filter_logic TEXT DEFAULT 'AND',
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL,
    p_distinct_config JSONB DEFAULT NULL
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
    distinct_col TEXT := NULL;
    distinct_json_field TEXT := NULL;
BEGIN
    -- Normalize p_json_field
    IF p_json_field = '' OR p_json_field = 'null' THEN
        p_json_field := NULL;
    END IF;

    -- Extract distinct config if provided
    IF p_distinct_config IS NOT NULL THEN
        distinct_col := p_distinct_config->>'column';
        distinct_json_field := p_distinct_config->>'jsonField';
        IF distinct_json_field = '' OR distinct_json_field = 'null' THEN
            distinct_json_field := NULL;
        END IF;
    END IF;

    -- Build base query
    IF p_aggregation = 'COUNT' THEN
        IF distinct_col IS NOT NULL THEN
            -- Count distinct values of the column specified in p_distinct_config
            IF distinct_json_field IS NOT NULL THEN
                base_query := 'SELECT COUNT(DISTINCT (' || quote_ident(distinct_col) || '->>' || quote_literal(distinct_json_field) || ')) as result FROM pype_voice_call_logs WHERE agent_id = $1 AND ' ||
                              quote_ident(distinct_col) || '->>' || quote_literal(distinct_json_field) || ' IS NOT NULL AND ' ||
                              quote_ident(distinct_col) || '->>' || quote_literal(distinct_json_field) || ' != ''''';
            ELSE
                base_query := 'SELECT COUNT(DISTINCT ' || quote_ident(distinct_col) || ') as result FROM pype_voice_call_logs WHERE agent_id = $1 AND ' || quote_ident(distinct_col) || ' IS NOT NULL';
            END IF;
        ELSE
            base_query := 'SELECT COUNT(*) as result FROM pype_voice_call_logs WHERE agent_id = $1';
        END IF;

    ELSIF p_aggregation = 'COUNT_DISTINCT' THEN
        IF p_json_field IS NOT NULL THEN
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

    -- Add date range conditions
    IF p_date_from IS NOT NULL THEN
        where_conditions := array_append(where_conditions,
            'call_started_at >= ' || quote_literal(p_date_from || ' 00:00:00'));
    END IF;

    IF p_date_to IS NOT NULL THEN
        where_conditions := array_append(where_conditions,
            'call_started_at <= ' || quote_literal(p_date_to || ' 23:59:59.999'));
    END IF;

    -- For COUNT operations with JSON fields, add the field existence check
    IF p_aggregation = 'COUNT' AND p_json_field IS NOT NULL AND distinct_col IS NULL THEN
        where_conditions := array_append(where_conditions,
            quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ' IS NOT NULL AND ' ||
            quote_ident(p_column_name) || '->>' || quote_literal(p_json_field) || ' != ''''');
    END IF;

    -- Process custom filters
    FOR filter_item IN SELECT * FROM jsonb_array_elements(p_filters)
    LOOP
        filter_condition := build_single_filter_condition(filter_item);
        IF filter_condition IS NOT NULL AND filter_condition != '' THEN
            filter_conditions := array_append(filter_conditions, filter_condition);
        END IF;
    END LOOP;

    -- Build final WHERE clause
    final_where := '';
    IF array_length(where_conditions, 1) > 0 THEN
        final_where := ' AND ' || array_to_string(where_conditions, ' AND ');
    END IF;

    IF array_length(filter_conditions, 1) > 0 THEN
        IF p_filter_logic = 'OR' THEN
            final_where := final_where || ' AND (' || array_to_string(filter_conditions, ' OR ') || ')';
        ELSE
            final_where := final_where || ' AND (' || array_to_string(filter_conditions, ' AND ') || ')';
        END IF;
    END IF;

    base_query := base_query || final_where;

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

-- Also update batch_calculate_custom_totals to forward distinct_config
CREATE OR REPLACE FUNCTION batch_calculate_custom_totals(
  p_agent_id uuid,
  p_configs jsonb,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date
)
RETURNS TABLE(config_id text, result numeric, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_item JSONB;
  aggregation TEXT;
  column_name TEXT;
  json_field TEXT;
  filters JSONB;
  filter_logic TEXT;
  distinct_config JSONB;
  calc_result RECORD;
BEGIN
  FOR config_item IN SELECT * FROM jsonb_array_elements(p_configs)
  LOOP
    aggregation := config_item->>'aggregation';
    column_name := config_item->>'column';
    json_field := config_item->>'jsonField';
    filters := COALESCE(config_item->'filters', '[]'::jsonb);
    filter_logic := COALESCE(config_item->>'filterLogic', 'AND');
    distinct_config := config_item->'distinct';

    SELECT * INTO calc_result
    FROM calculate_custom_total(
      p_agent_id,
      aggregation,
      column_name,
      json_field,
      filters,
      filter_logic,
      p_date_from,
      p_date_to,
      distinct_config
    );

    RETURN QUERY SELECT
      config_item->>'id',
      calc_result.result,
      calc_result.error_message;
  END LOOP;
END;
$$;
