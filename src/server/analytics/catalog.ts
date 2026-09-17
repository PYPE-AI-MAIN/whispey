/**
 * The field catalog — Confluence "Analytics Phase 1 and 2 — Build Spec" §11.1.
 *
 * One place that knows, per agent: which fields exist, their human name, their
 * type, how true/false is written, which values mean empty, the possible
 * values, how often the field is filled in, and whether it could identify a
 * patient.
 *
 * It is needed in phase 1, not phase 2 — the field picker, the filter chips and
 * the outcome-order editor all read from it, and without it the UI would sample
 * the call log on every page load.
 *
 * It helps people find fields; it never restricts them. A field missing from
 * here still works, because the query builder validates the base column and
 * passes the path as a parameter regardless.
 */
import { BOOLEAN_VALUES, BOOLEAN_ENCODINGS, DEFAULT_SENTINELS, JSON_COLS } from './spec'
import { runQuery } from './db'

/** Depth 2 covers metadata.usage.llm_prompt_tokens. Deeper fields still chart; they just are not offered. */
const MAX_DEPTH = 2
/** ponytail: whole-table scan is the alternative. Raise it if agents start producing rarer fields. */
const SAMPLE_ROWS = 2000
const SAMPLE_DAYS = 90
/** Above this a field is a value, not a category. */
const ENUM_MAX_DISTINCT = 15

export type FieldStats = {
  path: string[]
  rows_with_key: number
  rows_sampled: number
  n_object: number
  n_array: number
  n_number: number
  n_boolean: number
  n_string: number
  n_null: number
  n_sentinel: number
  distinct_values: number
  sample_values: string[]
}

export type FieldInference = {
  label: string
  value_type: 'boolean' | 'number' | 'enum' | 'text' | 'json'
  encoding: 'native' | 'json_string'
  boolean_encoding?: (typeof BOOLEAN_ENCODINGS)[number]
  json_shape?: 'scalar' | 'object' | 'array'
  enum_values?: string[]
  coverage_pct: number
  cardinality_est: number
  is_identity_candidate: boolean
  is_dimension: boolean
}

/** Words that mean "this could be the same patient or appointment across calls". */
const IDENTITY_HINT = /(^|_)(id|ids|uuid|mrn|phone|mobile|number|appointment|appointmentid|patient|booking|ticket)($|_)/i

/** 'is_task_complete' and 'finalDisposition' both have to become something a nurse can read. */
export function humanise(segment: string): string {
  const words = segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return segment
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '')
}

function looksLikeJson(text: string): boolean {
  const t = text.trim()
  if (!(t.startsWith('[') || t.startsWith('{'))) return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}

const NUMERIC = /^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$/

/**
 * Works out what a field is, in the order §11.2 sets out. Empty values are
 * ignored while deciding, so one 'N/A' does not turn a true/false field into
 * text. Nothing here is applied silently — everything stays "worked out, not
 * confirmed" until a person checks it, which is what `type_confirmed` records.
 */
export function inferField(stats: FieldStats): FieldInference {
  const nonEmpty = Math.max(0, stats.rows_with_key - stats.n_null - stats.n_sentinel)
  const coverage_pct = stats.rows_sampled > 0 ? Math.round((nonEmpty / stats.rows_sampled) * 1000) / 10 : 0
  const leaf = stats.path[stats.path.length - 1] ?? ''
  const label = humanise(leaf)
  const values = stats.sample_values.filter((v) => v !== null && v !== undefined)
  const meaningful = values
    .map((v) => v.trim())
    .filter((v) => v !== '' && !(DEFAULT_SENTINELS as readonly string[]).includes(v.toLowerCase()))

  const base = {
    label,
    coverage_pct,
    cardinality_est: stats.distinct_values,
    is_identity_candidate: IDENTITY_HINT.test(leaf) && stats.distinct_values > Math.max(5, nonEmpty * 0.5),
    is_dimension: true,
  }

  // real JSON first — read its type rather than guessing from its text
  if (stats.n_object > 0 && stats.n_object >= stats.n_array) {
    return { ...base, value_type: 'json', encoding: 'native', json_shape: 'object', is_dimension: false }
  }
  if (stats.n_array > 0) {
    return { ...base, value_type: 'json', encoding: 'native', json_shape: 'array', is_dimension: false }
  }
  if (stats.n_boolean > 0 && stats.n_boolean >= nonEmpty) {
    return { ...base, value_type: 'boolean', encoding: 'native', boolean_encoding: 'true_false' }
  }
  if (stats.n_number > 0 && stats.n_number >= nonEmpty) {
    return { ...base, value_type: 'number', encoding: 'native', is_dimension: false }
  }

  // text that parses as JSON — the shape §5.1 calls "JSON stored as text"
  if (meaningful.length > 0 && meaningful.every(looksLikeJson)) {
    return {
      ...base,
      value_type: 'json',
      encoding: 'json_string',
      json_shape: meaningful[0].trim().startsWith('[') ? 'array' : 'object',
      is_dimension: false,
    }
  }

  // true/false, written four ways, sometimes more than one way on one field
  if (meaningful.length > 0) {
    const lowered = new Set(meaningful.map((v) => v.toLowerCase()))
    for (const encoding of BOOLEAN_ENCODINGS) {
      const allowed = new Set([...BOOLEAN_VALUES[encoding].t, ...BOOLEAN_VALUES[encoding].f])
      if ([...lowered].every((v) => allowed.has(v))) {
        return { ...base, value_type: 'boolean', encoding: 'native', boolean_encoding: encoding }
      }
    }
  }

  if (meaningful.length > 0 && meaningful.every((v) => NUMERIC.test(v))) {
    return { ...base, value_type: 'number', encoding: 'native', is_dimension: false }
  }

  if (stats.distinct_values > 0 && stats.distinct_values <= ENUM_MAX_DISTINCT) {
    return { ...base, value_type: 'enum', encoding: 'native', enum_values: meaningful.slice(0, ENUM_MAX_DISTINCT).sort() }
  }

  return { ...base, value_type: 'text', encoding: 'native' }
}

/**
 * Reads what one agent actually produces. The base column is chosen from a
 * closed list, so it is the only thing written into the SQL text.
 */
export async function scanColumn(agentId: string, col: (typeof JSON_COLS)[number]): Promise<FieldStats[]> {
  const sql = `
    WITH sample AS (
      SELECT ${col} AS doc
      FROM   pype_voice_call_logs
      WHERE  agent_id = $1::uuid
        AND  call_started_at >= now() - ($2 || ' days')::interval
        AND  ${col} IS NOT NULL
      ORDER  BY call_started_at DESC
      LIMIT  $3
    ),
    counted AS (SELECT count(*)::int AS total FROM sample),
    lvl1 AS (
      SELECT ARRAY[e.k] AS path, e.v AS v
      FROM   sample, LATERAL jsonb_each(doc) AS e(k, v)
      WHERE  jsonb_typeof(doc) = 'object'
    ),
    lvl2 AS (
      SELECT l.path || e2.k AS path, e2.v AS v
      FROM   lvl1 l, LATERAL jsonb_each(l.v) AS e2(k, v)
      WHERE  ${MAX_DEPTH} >= 2 AND jsonb_typeof(l.v) = 'object'
    ),
    kv AS (SELECT * FROM lvl1 UNION ALL SELECT * FROM lvl2)
    SELECT path,
           count(*)::int                                            AS rows_with_key,
           (SELECT total FROM counted)                              AS rows_sampled,
           count(*) FILTER (WHERE jsonb_typeof(v) = 'object')::int   AS n_object,
           count(*) FILTER (WHERE jsonb_typeof(v) = 'array')::int    AS n_array,
           count(*) FILTER (WHERE jsonb_typeof(v) = 'number')::int   AS n_number,
           count(*) FILTER (WHERE jsonb_typeof(v) = 'boolean')::int  AS n_boolean,
           count(*) FILTER (WHERE jsonb_typeof(v) = 'string')::int   AS n_string,
           count(*) FILTER (WHERE jsonb_typeof(v) = 'null')::int     AS n_null,
           count(*) FILTER (WHERE lower(btrim(v #>> '{}')) = ANY($4::text[]))::int AS n_sentinel,
           count(DISTINCT left(v #>> '{}', 120))::int                AS distinct_values,
           (array_agg(DISTINCT left(v #>> '{}', 120))
              FILTER (WHERE jsonb_typeof(v) NOT IN ('object', 'array')))[1:60] AS sample_values
    FROM   kv
    GROUP  BY path
    ORDER  BY rows_with_key DESC
    LIMIT  300`

  const rows = await runQuery<Record<string, unknown>>(
    sql,
    [agentId, String(SAMPLE_DAYS), SAMPLE_ROWS, DEFAULT_SENTINELS.map((s) => s.toLowerCase())],
    30_000
  )
  return rows.map((r) => ({ ...r, sample_values: (r.sample_values as string[] | null) ?? [] })) as unknown as FieldStats[]
}
