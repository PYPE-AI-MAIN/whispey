-- Call log filters: support neq / not_equals, read JSON "operator" from the app,
-- and treat JSON path columns (metadata->>'key') as raw SQL expressions.

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
    base_expr := column_name;
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
