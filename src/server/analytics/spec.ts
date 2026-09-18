/**
 * The saved chart object — Confluence "Analytics Phase 1 and 2 — Build Spec" §7.
 *
 * This is the only contract between the canvas, the suggestion engine, the LLM
 * and the SQL compiler. It describes WHAT the user asked for, never HOW: a field
 * path and a calculation, never a chart library name and never raw SQL.
 *
 * Fixed shape, free field (§7.1): everything that reaches the SQL *text*
 * (calculations, operators, base columns, buckets) is checked against a closed
 * list here. Everything free-form (JSON paths, filter values, category lists,
 * outcome orders) is passed to Postgres as a bind parameter. That one rule is
 * what makes arbitrary JSON nesting and injection safety the same mechanism.
 *
 * `kind` (bar / line / table) is deliberately absent — chart type is
 * presentational and never reaches the query code.
 */
import { z } from 'zod'

/* ------------------------------------------------------------------ columns */

/** JSONB columns a field path may be read out of. */
export const JSON_COLS = ['metadata', 'transcription_metrics', 'metrics', 'dynamic_variables'] as const

/** Pseudo-column: one item produced by array expansion. Only valid at grain = 'element'. */
export const ELEMENT_COL = 'element'

/** Real text columns usable as a dimension or a distinct-count. */
export const TEXT_COLS = [
  'call_id', 'agent_id', 'customer_number', 'call_ended_reason',
  'transcript_type', 'environment', 'wcall_event',
] as const

/**
 * Real numeric columns — no cast needed, no coverage problem. `total_cost` is
 * the one exception: there is no such column, it is the three cost columns
 * added up, and it is here rather than in the spec so the expression stays a
 * fixed string the user never writes.
 */
export const NUMERIC_COLS = [
  'duration_seconds', 'call_duration_seconds', 'billing_duration_seconds', 'avg_latency',
  'total_stt_cost', 'total_tts_cost', 'total_llm_cost', 'total_cost',
] as const
// p50_latency is in setup-supabase.sql but not on the live database. A column
// that exists only in the repo turns every chart using it into a hard error, so
// this list is what production actually has, checked against
// information_schema rather than the DDL file.

/**
 * Columns that are an expression rather than a column. Keys only ever come from
 * NUMERIC_COLS, so nothing a user wrote reaches the SQL text.
 *
 * `call_duration_seconds` exists because `duration_seconds` is NULL on every
 * row: its DDL default computes it at INSERT, and at insert time the call has
 * not ended yet — the later UPDATE never recomputes it. Measuring the two
 * timestamps is the only way to get a call's length, and `call_ended_at >
 * call_started_at` throws away the rows where they arrived out of order rather
 * than reporting a negative call.
 */
export const COLUMN_EXPRESSIONS: Record<string, (t: string) => string> = {
  // NULL when no cost was recorded at all, rather than a confident zero. A
  // coalesce here reported 100% coverage for an agent whose costs are never
  // written, which is the exact opposite of what the coverage line is for.
  total_cost: (t) =>
    `(CASE WHEN ${t}.total_llm_cost IS NOT NULL OR ${t}.total_tts_cost IS NOT NULL OR ${t}.total_stt_cost IS NOT NULL
           THEN coalesce(${t}.total_llm_cost, 0) + coalesce(${t}.total_tts_cost, 0) + coalesce(${t}.total_stt_cost, 0) END)`,
  call_duration_seconds: (t) =>
    `(CASE WHEN ${t}.call_ended_at > ${t}.call_started_at
           THEN EXTRACT(epoch FROM (${t}.call_ended_at - ${t}.call_started_at)) END)`,
}

/** Which real columns each expression needs carried through the query. */
export const EXPRESSION_SOURCES: Record<string, string[]> = {
  total_cost: ['total_llm_cost', 'total_tts_cost', 'total_stt_cost'],
  call_duration_seconds: ['call_started_at', 'call_ended_at'],
}

export const SCALAR_COLS = [...TEXT_COLS, ...NUMERIC_COLS] as const

const ALL_COLS = new Set<string>([...JSON_COLS, ...SCALAR_COLS, ELEMENT_COL])
const JSON_COL_SET = new Set<string>([...JSON_COLS, ELEMENT_COL])
export const NUMERIC_COL_SET = new Set<string>(NUMERIC_COLS)

/* ------------------------------------------------------------------- pieces */

export const BOOLEAN_ENCODINGS = ['one_zero', 'true_false', 'yes_no', 'y_n'] as const

/** Which literals count as true / false, per §5.1 ("true/false is written three ways"). */
export const BOOLEAN_VALUES: Record<(typeof BOOLEAN_ENCODINGS)[number], { t: string[]; f: string[] }> = {
  one_zero:   { t: ['1'],    f: ['0'] },
  true_false: { t: ['true'], f: ['false'] },
  yes_no:     { t: ['yes'],  f: ['no'] },
  y_n:        { t: ['y'],    f: ['n'] },
}

/**
 * Values that mean "nothing here", per §5.1. Written four ways inside one
 * column, so they are matched case-insensitively and after trimming.
 *
 * '-' is included because it is far more often noise than signal, but it does
 * sometimes mean "the check did not apply" — which is why the field catalog
 * stores per-field sentinels and every card reports its coverage.
 */
export const DEFAULT_SENTINELS = ['', '-', 'null', 'n/a'] as const

/** A reference to one value: a JSON path, an array element, or a real column. */
export const Ref = z
  .object({
    col: z.string(),
    /** JSON path, any depth. Passed to Postgres as text[], never spliced into SQL. */
    path: z.array(z.string().min(1).max(200)).max(10).optional(),
    /** 'json_string' = the value is JSON stored as text (§5.1) and must be parsed before expanding. */
    encoding: z.enum(['native', 'json_string']).default('native'),
    boolean_encoding: z.enum(BOOLEAN_ENCODINGS).optional(),
  })
  .superRefine((r, ctx) => {
    if (!ALL_COLS.has(r.col)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown column: ${r.col}` })
      return
    }
    if (JSON_COL_SET.has(r.col)) {
      // an element may be a plain scalar, so it alone may carry no path
      if (r.col !== ELEMENT_COL && !r.path?.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${r.col} needs a path` })
      }
    } else if (r.path?.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${r.col} is a column, not a JSON document` })
    }
  })
export type Ref = z.infer<typeof Ref>

export const OPERATORS = [
  'eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte',
  'contains', 'starts_with', 'is_empty', 'is_not_empty', 'is_true', 'is_false',
] as const

const Condition = z.object({
  field: Ref,
  op: z.enum(OPERATORS),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()])).max(1000)]).optional(),
})
export type Condition = z.infer<typeof Condition>

/** A condition, or an and/or group of them. Groups nest, so the safety-flag tables are expressible. */
export type FilterNode = Condition | { op: 'and' | 'or'; children: FilterNode[] }
type ConditionInput = z.input<typeof Condition>
export type FilterNodeInput = ConditionInput | { op: 'and' | 'or'; children: FilterNodeInput[] }
export const FilterNode: z.ZodType<FilterNode, z.ZodTypeDef, FilterNodeInput> = z.lazy(() =>
  z.union([
    Condition,
    z.object({ op: z.enum(['and', 'or']), children: z.array(FilterNode).min(1).max(50) }),
  ])
)

export const AGG_FNS = [
  'count', 'count_distinct', 'rate', 'sum', 'avg', 'min', 'max', 'stddev', 'p50', 'p90', 'p95',
] as const

const Agg = z.object({
  fn: z.enum(AGG_FNS),
  field: Ref.optional(),
  /** rate only: count the true values (default) or the false ones. */
  match: z.boolean().default(true),
  /**
   * rate only, and the number people get wrong: "% confirmed" over 400 calls
   * where only 185 carry the field is 400 or 185 — they differ by more than
   * double. Default to the rows that actually have the field, and always
   * return n_rows and n_nonnull so the card can show both (§8.5).
   */
  denominator: z.enum(['field_present', 'all_rows']).default('field_present'),
})

export const BUCKETS = ['none', 'auto', 'hour', 'day', 'week', 'month'] as const

/**
 * One row per patient / per appointment (§8.2, §10.6). Ranking over the entity's
 * full history rather than just the chart window is what stops the same
 * appointment reporting different outcomes in two adjacent date ranges.
 */
const Dedupe = z.object({
  key: z.object({
    field: Ref,
    /** With no key, a call is its own entity — and the card must say how many. */
    fallback: z.enum(['call_id', 'none']).default('call_id'),
  }),
  winner: z.enum(['best_outcome', 'most_recent', 'first']).default('best_outcome'),
  /** Which field carries the outcome. Required when winner = 'best_outcome'. */
  outcome: Ref.optional(),
  /** Where the outcome order comes from. The route resolves it into `ranking`. */
  ranking_ref: z.enum(['agent', 'inline']).default('agent'),
  /** The resolved order, best first. Filled in server-side from pype_voice_agents.outcome_ranking. */
  ranking: z.array(z.string()).max(200).optional(),
  lookback_days: z.number().int().min(0).max(365).default(90),
})

export const Spec = z
  .object({
    spec_version: z.literal(1),
    source: z.enum(['voice', 'whatsapp', 'journeys']).default('voice'),
    grain: z.enum(['interaction', 'element', 'entity']).default('interaction'),

    dedupe: Dedupe.optional(),
    /** grain = 'element': which array to expand, one row per item. */
    element_source: Ref.optional(),

    agg: Agg,
    dimension: z
      .object({
        field: Ref,
        limit: z.number().int().min(1).max(500).default(50),
        /** Show the empty bucket as its own category rather than dropping it. */
        include_empty: z.boolean().default(false),
        /**
         * Fold case before grouping. `is_Conversation_hindi` holds yes, no,
         * Yes, No and 0 on one agent, which without this draws five series for
         * a field with two answers. Applied in SQL rather than in the renderer
         * so the chart and the drill-down underneath it agree about what a
         * bucket contains.
         */
        case_insensitive: z.boolean().default(false),
      })
      .optional(),

    /** Applied BEFORE picking a winner — changes which attempt wins. */
    filters: z.array(FilterNode).max(50).default([]),
    /** Applied to the winners. This is where the user's filter chips go. */
    having: z.array(FilterNode).max(50).default([]),

    range: z.union([
      z.object({ days: z.number().int().min(1).max(730) }),
      z.object({ from: z.string(), to: z.string() }), // local dates, YYYY-MM-DD
    ]),
    /** Local wall-clock window. 'from' after 'to' means it crosses midnight. */
    time_of_day: z.object({ from: z.string(), to: z.string() }).optional(),
    /**
     * Which days count, 1 = Monday to 7 = Sunday, in the project's zone. A
     * hospital's weekend behaves nothing like its Tuesday, and averaging them
     * together hides both.
     */
    days_of_week: z.array(z.number().int().min(1).max(7)).max(7).optional(),
    bucket: z.enum(BUCKETS).default('none'),

    live: z.boolean().default(false),
    /**
     * Environments to leave out (§5.6 — test calls are in every number today).
     *
     * Empty by default, deliberately. Defaulting this to ['dev'] zeroed every
     * chart on every agent deployed to dev — 1,903 of 1,911 rows in that
     * database — and did it silently, which is precisely what §10.3 forbids:
     * a filter that is on but hidden makes every number wrong without anyone
     * noticing. Environment belongs in a filter chip you can see and remove.
     */
    exclude_environments: z.array(z.string()).max(20).default([]),
    /** Completed calls only by default — a call_started row with no end is a live call (§5.5). */
    include_live_calls: z.boolean().default(false),
    sentinels: z.array(z.string()).max(50).default([...DEFAULT_SENTINELS]),

    display: z
      .object({
        round: z.number().int().min(0).max(6).default(1),
        unit: z.string().max(16).optional(),
        /** Presentational only — seconds charted as minutes, never a change to the query. */
        scale: z.number().finite().optional(),
        direction: z.enum(['higher_is_better', 'lower_is_better', 'neutral']).default('neutral'),
        empty_text: z.string().max(200).optional(),
        value_map: z.record(z.string()).optional(),
      })
      .default({ round: 1, direction: 'neutral' }),
  })
  .superRefine((s, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message })
    checkGrain(s, fail)

    if (s.agg.fn !== 'count' && !s.agg.field) fail(`${s.agg.fn} needs a field`)
    if (s.agg.fn === 'rate' && s.agg.field && !s.agg.field.boolean_encoding) {
      fail('rate needs boolean_encoding — true/false is written four ways in this data')
    }
    if (s.dedupe?.winner === 'best_outcome' && !s.dedupe.outcome) {
      fail('winner "best_outcome" needs an outcome field')
    }
    if (s.bucket !== 'none' && s.dimension && s.dimension.limit > 50) {
      fail('a time bucket plus a breakdown is limited to 50 categories')
    }
  })

export type Spec = z.infer<typeof Spec>
/** The shape before defaults are applied — what the UI and the LLM actually write. */
export type SpecInput = z.input<typeof Spec>

function refsElement(s: z.infer<typeof Spec>): boolean {
  return [s.agg.field, s.dimension?.field, s.dedupe?.key.field, s.dedupe?.outcome]
    .some((r) => r?.col === ELEMENT_COL)
}

/** grain, dedupe and element_source have to agree with each other — pulled out of superRefine to keep it under the complexity limit. */
function checkGrain(s: z.infer<typeof Spec>, fail: (message: string) => void): void {
  if (s.grain === 'entity' && !s.dedupe) fail('grain "entity" needs dedupe')
  if (s.grain !== 'entity' && s.dedupe) fail('dedupe only applies at grain "entity"')
  if (s.grain === 'element' && !s.element_source) fail('grain "element" needs element_source')
  if (s.grain !== 'element' && refsElement(s)) fail('"element" is only readable at grain "element"')
}
