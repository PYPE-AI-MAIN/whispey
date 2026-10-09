-- Closes the injection in build_single_filter_condition, without removing it.
--
-- The analytics work deletes calculate_custom_total and the summary functions,
-- but get_call_logs_with_distinct — which powers the Call Logs tab and is not
-- part of phase 1 — also calls this, so it has to stay until Call Logs moves to
-- the TypeScript query builder too.
--
-- The hole: when the caller's column name contains '->' it was used as raw SQL
-- inside a SECURITY DEFINER function. EXECUTE from PUBLIC/anon/authenticated is
-- already revoked, so this is now only reachable through our own server code —
-- but "only our code builds the string" is exactly the assumption that stops
-- being true later.
--
-- The app sends JSON columns in one shape: transcription_metrics->>'tags', or
-- metadata->'usage'->>'llm_prompt_tokens'. Anything matching that pattern is
-- safe to use verbatim: an identifier cannot contain a quote or a semicolon,
-- and a literal written as '[^']*' cannot close itself early. Anything else is
-- refused loudly rather than dropped, because a filter that silently disappears
-- gives a wrong answer that looks right.

CREATE OR REPLACE FUNCTION assert_json_column_expression(column_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF column_name !~* '^[a-z_][a-z0-9_]*(\s*->>?\s*''[^'']*'')+$' THEN
    RAISE EXCEPTION 'unsupported column expression: %', column_name
      USING HINT = 'expected identifier->>''key'' or identifier->''key''->>''key''';
  END IF;
  RETURN column_name;
END $$ LANGUAGE plpgsql IMMUTABLE;

REVOKE EXECUTE ON FUNCTION assert_json_column_expression(TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION assert_json_column_expression(TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Same function as migrations/call_logs_filter_neq_and_operator.sql, with the
-- raw '->' branch replaced by a checked one.

CREATE OR REPLACE FUNCTION build_single_filter_condition(filter_obj JSONB)
RETURNS TEXT AS $$
DECLARE
  column_name TEXT;
  json_field TEXT;
  operation TEXT;
  filter_value TEXT;
  condition TEXT := '';
  base_expr TEXT;
BEGIN
  column_name := filter_obj->>'column';
  json_field := filter_obj->>'jsonField';
  operation := COALESCE(NULLIF(filter_obj->>'operation', ''), filter_obj->>'operator');
  filter_value := filter_obj->>'value';

  IF json_field = '' OR json_field = 'null' THEN
    json_field := NULL;
  END IF;

  IF column_name IS NULL OR operation IS NULL THEN
    RETURN '';
  END IF;

  IF position('->' IN column_name) > 0 THEN
    base_expr := assert_json_column_expression(column_name);
  ELSE
    base_expr := quote_ident(column_name);
  END IF;

  CASE
    WHEN operation IN ('equals', 'json_equals', 'eq') THEN
      IF json_field IS NOT NULL THEN
        condition := base_expr || '->>' || quote_literal(json_field) || ' = ' || quote_literal(filter_value);
      ELSE
        condition := base_expr || ' = ' || quote_literal(filter_value);
      END IF;

    WHEN operation IN ('not_equals', 'json_not_equals', 'neq', '<>') THEN
      IF json_field IS NOT NULL THEN
        condition := '(' || base_expr || '->>' || quote_literal(json_field) || ') IS DISTINCT FROM ' || quote_literal(filter_value);
      ELSE
        condition := '(' || base_expr || ') IS DISTINCT FROM ' || quote_literal(filter_value);
      END IF;

    WHEN operation IN ('contains', 'json_contains') THEN
      IF json_field IS NOT NULL THEN
        condition := '(' || base_expr || '->>' || quote_literal(json_field) || ') ILIKE ' || quote_literal('%' || filter_value || '%');
      ELSE
        condition := base_expr || ' ILIKE ' || quote_literal('%' || filter_value || '%');
      END IF;

    WHEN operation = 'ilike' THEN
      IF json_field IS NOT NULL THEN
        condition := '(' || base_expr || '->>' || quote_literal(json_field) || ') ILIKE ' || quote_literal(filter_value);
      ELSE
        condition := base_expr || ' ILIKE ' || quote_literal(filter_value);
      END IF;

    WHEN operation = 'starts_with' THEN
      IF json_field IS NOT NULL THEN
        condition := '(' || base_expr || '->>' || quote_literal(json_field) || ') ILIKE ' || quote_literal(filter_value || '%');
      ELSE
        condition := base_expr || ' ILIKE ' || quote_literal(filter_value || '%');
      END IF;

    WHEN operation IN ('greater_than', 'json_greater_than', 'gt') THEN
      IF json_field IS NOT NULL THEN
        condition := '(' || base_expr || '->>' || quote_literal(json_field) || ')::NUMERIC > ' || quote_literal(filter_value) || '::NUMERIC';
      ELSE
        condition := base_expr || ' > ' || quote_literal(filter_value) || '::NUMERIC';
      END IF;

    WHEN operation IN ('less_than', 'json_less_than', 'lt') THEN
      IF json_field IS NOT NULL THEN
        condition := '(' || base_expr || '->>' || quote_literal(json_field) || ')::NUMERIC < ' || quote_literal(filter_value) || '::NUMERIC';
      ELSE
        condition := base_expr || ' < ' || quote_literal(filter_value) || '::NUMERIC';
      END IF;

    WHEN operation = 'gte' THEN
      condition := base_expr || ' >= ' || quote_literal(filter_value);

    WHEN operation = 'json_exists' THEN
      IF json_field IS NOT NULL THEN
        condition := '(' || base_expr || '->>' || quote_literal(json_field) || ') IS NOT NULL AND (' ||
                    base_expr || '->>' || quote_literal(json_field) || ') != ''''';
      ELSE
        condition := base_expr || ' IS NOT NULL';
      END IF;

    WHEN operation = 'not.is' THEN
      condition := base_expr || ' IS NOT NULL';

    ELSE
      condition := '';
  END CASE;

  RETURN condition;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
