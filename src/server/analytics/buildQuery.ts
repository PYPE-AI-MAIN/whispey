/**
 * The one place that turns a saved chart object into SQL — Confluence
 * "Analytics Phase 1 and 2 — Build Spec" §8. Charts, click-through, export,
 * suggestions and (later) the LLM all come through here, so a fix lands once.
 *
 * Two rules hold the whole thing up:
 *
 *  1. Only closed-list tokens are ever written into the SQL text — calculations,
 *     operators, base columns, time buckets. Everything the user chose freely
 *     (JSON paths, filter values, category lists, outcome orders) is a bind
 *     parameter. `metadata #>> $1` with $1 as text[] handles any nesting depth,
 *     fields that differ per agent, and injection safety in one mechanism.
 *
 *  2. Tenancy comes from `ctx`, never from the saved object. A spec is data a
 *     user (or a model) wrote; it can never widen what it is allowed to read.
 */
import {
  Spec,
  Ref,
  BOOLEAN_VALUES,
  NUMERIC_COL_SET,
  COLUMN_EXPRESSIONS,
  EXPRESSION_SOURCES,
  ELEMENT_COL,
  JSON_COLS,
  TEXT_COLS,
  NUMERIC_COLS,
  type Condition,
  type FilterNode,
} from './spec'

/**
 * Whether pype_voice_call_logs.project_id is backfilled on THIS database.
 *
 * The column and its trigger exist everywhere once the migration runs, but the
 * backfill is a separate, out-of-hours job per environment — so the same build
 * deploys to a database that is done and one that is not. Filtering on a column
 * that is still half NULL would silently drop rows, which is worse than the
 * join it replaces.
 *
 * Set ANALYTICS_PROJECT_ID_BACKFILLED=true once
 * `SELECT count(*) FILTER (WHERE project_id IS NULL)` reads zero there.
 *
 * Either way the tenant boundary is the resolved agent list below, which is
 * always applied; this predicate is defence in depth and a cheap first filter
 * for the planner.
 */
const HAS_PROJECT_ID_COLUMN = process.env.ANALYTICS_PROJECT_ID_BACKFILLED === 'true'

/**
 * call_started_at / call_ended_at / created_at are `timestamp without time
 * zone` holding UTC. Bucketing converts to the project's named zone here;
 * §6.5 migrates the columns to timestamptz, after which the first
 * `AT TIME ZONE 'UTC'` comes out.
 */
const STORED_ZONE = 'UTC'

export type Ctx = {
  projectId: string
  /**
   * Every agent this request may read, already narrowed by project membership
   * and OrgVisibility.visibleAgentIds. Never empty — an empty list is a 403 at
   * the route, not an unfiltered query here.
   */
  agentIds: string[]
  /**
   * Fields this member may NOT read — the same deny set the Call Logs column
   * picker already produces (`getDisallowedColumns`), so analytics and logs
   * cannot disagree about who sees the cost column. A denied base column blocks
   * every path underneath it.
   */
  deniedFields: Set<string>
  /** Named zone, e.g. 'Asia/Kolkata'. Never a fixed offset. */
  tz: string
  maxDays: number
  /** Pinned in tests so "last 30 days" is reproducible. */
  now?: Date
}

export type Target = 'aggregate' | 'drill' | 'export'

export type BuildOpts = {
  /**
   * Other charts that share this one's base — same rows, different sums.
   *
   * Eight of the twelve starter charts are a count over the same agent, the
   * same range and the same rules; only the calculation and the filter differ.
   * Run separately that is eight scans of the same rows and, more expensively,
   * eight round trips to another region. Given as companions they become extra
   * columns on one scan.
   *
   * Their filters move into FILTER clauses rather than the WHERE, which is what
   * lets "completed" and "incomplete" share a pass.
   */
  companions?: { id: string; agg: Spec['agg']; having: Spec['having'] }[]
  /** drill/export: which bar was clicked. null means the empty bucket. */
  dimensionValue?: string | null
  /** drill/export: keyset cursor from the previous page. Never OFFSET (§9.4). */
  cursor?: { startedAt: string; id: string }
  limit?: number
}

export type Built = {
  sql: string
  params: unknown[]
  /** What the card has to show so a number is never unexplained. */
  meta: {
    bucket: 'none' | 'hour' | 'day' | 'week' | 'month'
    /** True when the filter chips ran after picking a winner — the default. */
    filtersAfterDedupe: boolean
    rangeUtc: { from: string; to: string }
    lookbackDays: number
  }
}

/** Something the person can act on: no permission, no outcome order, range too long. */
export class SpecError extends Error {}

/**
 * A bug in this file. The message names the invariant so it is useful in a log,
 * and it never reaches the screen — a card reading "parameter $6 was bound but
 * never used" tells a nurse nothing and tells them it is their fault.
 */
export class InternalSpecError extends Error {}

/* ------------------------------------------------------------ time in a zone */

/** Wall clock in `tz` at instant `at`, as "YYYY-MM-DD HH:MM:SS". */
function wallClock(at: Date, tz: string): string {
  return at.toLocaleString('sv-SE', { timeZone: tz })
}

/** The UTC instant at which `tz` reads this wall clock. Two passes covers DST edges. */
function wallClockToUtc(wall: string, tz: string): Date {
  const asIfUtc = new Date(`${wall.replace(' ', 'T')}Z`)
  const offset = (w: Date) => Date.parse(`${wallClock(w, tz).replace(' ', 'T')}Z`) - w.getTime()
  const first = new Date(asIfUtc.getTime() - offset(asIfUtc))
  return new Date(asIfUtc.getTime() - offset(first))
}

function addDays(isoDate: string, n: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

/** `timestamp without time zone` literal — unambiguous, no session TimeZone involved. */
function pgTimestamp(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('Z', '')
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

function resolveRange(spec: Spec, ctx: Ctx) {
  const now = ctx.now ?? new Date()
  const today = wallClock(now, ctx.tz).slice(0, 10)

  let fromDate: string
  let toDateExclusive: string
  if ('days' in spec.range) {
    toDateExclusive = addDays(today, 1)
    fromDate = addDays(today, 1 - spec.range.days)
  } else {
    if (!ISO_DATE.test(spec.range.from) || !ISO_DATE.test(spec.range.to)) {
      throw new SpecError('range dates must be YYYY-MM-DD')
    }
    fromDate = spec.range.from
    toDateExclusive = addDays(spec.range.to, 1)
  }

  const days = Math.round((Date.parse(`${toDateExclusive}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000)
  if (days <= 0) throw new SpecError('range ends before it starts')
  if (days > ctx.maxDays) throw new SpecError(`range is ${days} days; the limit is ${ctx.maxDays}`)

  const lookbackDays = spec.grain === 'entity' ? (spec.dedupe?.lookback_days ?? 0) : 0
  return {
    lo: wallClockToUtc(`${fromDate} 00:00:00`, ctx.tz),
    hi: wallClockToUtc(`${toDateExclusive} 00:00:00`, ctx.tz),
    // ranking over the entity's full history, not just the chart window (§8.2)
    loWithLookback: wallClockToUtc(`${addDays(fromDate, -lookbackDays)} 00:00:00`, ctx.tz),
    days,
    lookbackDays,
  }
}

function autoBucket(days: number): 'hour' | 'day' | 'week' | 'month' {
  if (days <= 2) return 'hour'
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

/* --------------------------------------------------------------------- build */

export function buildQuery(spec: Spec, ctx: Ctx, target: Target, opts: BuildOpts = {}): Built {
  if (ctx.agentIds.length === 0) throw new SpecError('no readable agents')

  const params: unknown[] = []
  const bind = (v: unknown) => `$${params.push(v)}`

  const range = resolveRange(spec, ctx)

  // Bound on first use, not up front: a parameter that never appears in the SQL
  // makes Postgres reject the whole statement with "could not determine data
  // type". A `count(*)` with no dimension touches neither of these.
  let tzRef: string | null = null
  const tz = () => (tzRef ??= bind(ctx.tz))
  let sentinelRef: string | null = null
  const sentinels = () => (sentinelRef ??= bind(spec.sentinels.map((s) => s.toLowerCase())))

  /* ---- field access ---- */

  const keyOf = (ref: Ref) => (ref.path?.length ? `${ref.col}.${ref.path.join('.')}` : ref.col)
  const check = (ref: Ref | undefined) => {
    if (!ref || ctx.deniedFields.size === 0) return
    // deny the whole subtree: hiding `metadata` hides every path inside it, and
    // hiding one key hides only that key
    const denied =
      ctx.deniedFields.has(ref.col) ||
      (ref.path ?? []).some((_, i) => ctx.deniedFields.has(`${ref.col}.${ref.path!.slice(0, i + 1).join('.')}`))
    if (denied) throw new SpecError(`no permission for ${keyOf(ref)}`)
  }
  check(spec.agg.field)
  check(spec.dimension?.field)
  check(spec.dedupe?.key.field)
  check(spec.dedupe?.outcome)

  /* ---- value expressions ---- */

  /** Raw text of one value. `t` is the table alias holding the projected columns. */
  const rawText = (ref: Ref, t: string): string => {
    if (ref.col === ELEMENT_COL) return `(elem #>> ${bind(ref.path ?? [])}::text[])`
    if ((JSON_COLS as readonly string[]).includes(ref.col)) {
      return `(${t}.${ref.col} #>> ${bind(ref.path)}::text[])`
    }
    return `(${COLUMN_EXPRESSIONS[ref.col]?.(t) ?? `${t}.${ref.col}`})::text`
  }

  /** Text with the four ways of writing "empty" collapsed to NULL (§5.1). */
  const cleanText = (ref: Ref, t: string) => {
    const raw = rawText(ref, t)
    return `(CASE WHEN lower(btrim(${raw})) = ANY(${sentinels()}::text[]) THEN NULL ELSE btrim(${raw}) END)`
  }

  /**
   * Numbers, guarded. A real numeric column needs no guard; a JSON value has to
   * survive '₹500', '45%' and '1,200' without poisoning the query — those become
   * NULL, which is why n_nonnull is always returned beside the number.
   */
  const numeric = (ref: Ref, t: string) => {
    if (NUMERIC_COL_SET.has(ref.col)) return `${COLUMN_EXPRESSIONS[ref.col]?.(t) ?? `${t}.${ref.col}`}::numeric`
    const c = cleanText(ref, t)
    return `(CASE WHEN ${c} ~ '^-?[0-9]+(\\.[0-9]+)?([eE][-+]?[0-9]+)?$' THEN (${c})::numeric END)`
  }

  const boolean = (ref: Ref, t: string, want: boolean) => {
    const enc = BOOLEAN_VALUES[ref.boolean_encoding ?? 'true_false']
    return `(lower(btrim(${rawText(ref, t)})) = ANY(${bind(want ? enc.t : enc.f)}::text[]))`
  }

  /* ---- filters ---- */

  const condition = (c: Condition, t: string): string => {
    check(c.field)
    // built on demand, not up front: `is yes` and the numeric comparisons never
    // read the text form, and binding a parameter no branch uses makes Postgres
    // reject the whole statement
    let textRef: string | null = null
    const txt = () => (textRef ??= cleanText(c.field, t))
    const arr = (v: unknown) => bind((Array.isArray(v) ? v : [v]).map(String))
    switch (c.op) {
      case 'is_empty': return `${txt()} IS NULL`
      case 'is_not_empty': return `${txt()} IS NOT NULL`
      case 'is_true': return boolean(c.field, t, true)
      case 'is_false': return boolean(c.field, t, false)
      case 'eq': return `${txt()} = ${bind(String(c.value))}`
      case 'neq': return `(${txt()} IS DISTINCT FROM ${bind(String(c.value))})`
      case 'in': return `${txt()} = ANY(${arr(c.value)}::text[])`
      case 'not_in': return `(${txt()} IS NULL OR NOT (${txt()} = ANY(${arr(c.value)}::text[])))`
      case 'contains': return `${txt()} ILIKE '%' || ${bind(String(c.value))} || '%'`
      case 'starts_with': return `${txt()} ILIKE ${bind(String(c.value))} || '%'`
      case 'gt': case 'gte': case 'lt': case 'lte': {
        const op = { gt: '>', gte: '>=', lt: '<', lte: '<=' }[c.op]
        return `${numeric(c.field, t)} ${op} ${bind(Number(c.value))}`
      }
    }
  }

  const tree = (node: FilterNode, t: string): string => {
    if ('children' in node) {
      return `(${node.children.map((c) => tree(c, t)).join(node.op === 'and' ? ' AND ' : ' OR ')})`
    }
    return condition(node, t)
  }

  const conjunction = (nodes: FilterNode[], t: string) => nodes.map((n) => tree(n, t))

  /* ---- which raw columns have to survive the window function ---- */

  const refs = [spec.agg.field, spec.dimension?.field, spec.dedupe?.key.field, spec.dedupe?.outcome, spec.element_source]
  const collect = (nodes: FilterNode[]): Ref[] =>
    nodes.flatMap((n) => ('children' in n ? collect(n.children) : [n.field]))
  const allRefs = [
    ...refs,
    ...collect(spec.filters),
    ...collect(spec.having),
    // a companion reads the same rows but not necessarily the same columns —
    // "total minutes" needs call_ended_at and the count it shares a scan with
    // does not, so its columns have to survive the projection too
    ...(opts.companions ?? []).flatMap((c) => [c.agg.field, ...collect(c.having)]),
  ].filter(Boolean) as Ref[]

  const carried = new Set<string>(['call_id', 'agent_id', 'created_at'])
  for (const r of allRefs) {
    if (r.col === ELEMENT_COL) continue
    // an expression column needs its ingredients carried, not its own name
    const sources = EXPRESSION_SOURCES[r.col]
    if (sources) for (const c of sources) carried.add(c)
    else carried.add(r.col)
  }
  if (target !== 'aggregate') {
    for (const c of ['customer_number', 'call_ended_reason', 'call_ended_at', 'duration_seconds', 'recording_url']) {
      carried.add(c)
    }
  }
  // `id` is projected explicitly below and would be ambiguous twice over.
  // `call_started_at` is projected as `started_at`, but call_duration_seconds
  // measures it, so it is also carried under its own name — two output columns
  // from one source, which is legal and keeps one expression valid at every
  // stage of the query.
  carried.delete('id')

  /* ---- stage 1: the scan ---- */

  const where: string[] = []
  if (HAS_PROJECT_ID_COLUMN) where.push(`l.project_id = ${bind(ctx.projectId)}`)
  where.push(`l.agent_id = ANY(${bind(ctx.agentIds)}::uuid[])`)
  // the lookback bound, so the entity's whole history is rankable (§8.2)
  where.push(`l.call_started_at >= ${bind(pgTimestamp(range.loWithLookback))}::timestamp`)
  where.push(`l.call_started_at <  ${bind(pgTimestamp(range.hi))}::timestamp`)
  if (!spec.include_live_calls) {
    // a call_started row with no matching end is a call happening right now (§5.5)
    where.push(`coalesce(l.wcall_event, 'call_ended') = 'call_ended'`)
  }
  if (spec.exclude_environments.length) {
    where.push(`coalesce(l.environment, '') <> ALL(${bind(spec.exclude_environments)}::text[])`)
  }
  if (spec.time_of_day) {
    const { from, to } = spec.time_of_day
    if (!CLOCK.test(from) || !CLOCK.test(to)) throw new SpecError('time_of_day must be HH:MM')
    const local = `(l.call_started_at AT TIME ZONE '${STORED_ZONE}' AT TIME ZONE ${tz()})::time`
    const a = `${local} >= ${bind(from)}::time`
    const b = `${local} <  ${bind(to)}::time`
    // 22:00–02:00 is the night shift, not an empty range
    where.push(from > to ? `(${a} OR ${b})` : `(${a} AND ${b})`)
  }
  if (spec.days_of_week?.length && spec.days_of_week.length < 7) {
    // isodow so Monday is 1 and Sunday is 7, in the project's zone rather than UTC
    where.push(
      `EXTRACT(isodow FROM (l.call_started_at AT TIME ZONE '${STORED_ZONE}' AT TIME ZONE ${tz()})) = ANY(${bind(spec.days_of_week)}::int[])`
    )
  }
  for (const r of allRefs) {
    if (r.col === ELEMENT_COL && spec.grain !== 'element') throw new SpecError('element refs need grain "element"')
  }
  for (const n of spec.filters) {
    if (collect([n]).some((r) => r.col === ELEMENT_COL)) {
      throw new SpecError('pre-dedupe filters cannot read array items — put them in `having`')
    }
  }
  where.push(...conjunction(spec.filters, 'l'))

  const scanCols = [
    'l.id',
    'l.call_started_at AS started_at',
    `(l.call_started_at AT TIME ZONE '${STORED_ZONE}' AT TIME ZONE ${tz()}) AS started_local`,
    ...[...carried].map((c) => `l.${c}`),
  ]
  const ctes: string[] = [`scanned AS (\n  SELECT ${scanCols.join(', ')}\n  FROM pype_voice_call_logs l\n  WHERE ${where.join('\n    AND ')}\n)`]

  /* ---- stage 2: one row per patient / per appointment (§8.2, §10.6) ---- */

  let stage = 'scanned'
  if (spec.grain === 'entity') {
    const d = spec.dedupe!
    const key = cleanText(d.key.field, 's')
    const partition =
      d.key.fallback === 'call_id'
        ? `s.agent_id, COALESCE(${key}, 'no-key-' || s.call_id)`
        : `s.agent_id, ${key}`

    const order: string[] = []
    if (d.winner === 'best_outcome') {
      if (!d.ranking?.length) throw new SpecError('best_outcome needs the agent outcome order')
      // one list on the agent instead of a CASE ladder copied into every query
      order.push(`array_position(${bind(d.ranking)}::text[], ${cleanText(d.outcome!, 's')}) NULLS LAST`)
      order.push('s.created_at DESC')
    } else {
      order.push(d.winner === 'most_recent' ? 's.created_at DESC' : 's.created_at ASC')
    }
    order.push('s.id') // same answer every run — without it ties are whatever the planner returns

    // fallback 'none': a call with no appointment id is dropped rather than
    // silently grouped with every other keyless call
    const keyless = d.key.fallback === 'none' ? `\n  WHERE ${key} IS NOT NULL` : ''
    ctes.push(
      `ranked AS (\n  SELECT s.*, row_number() OVER (PARTITION BY ${partition} ORDER BY ${order.join(', ')}) AS rn\n  FROM scanned s${keyless}\n)`
    )
    ctes.push(
      `picked AS (\n  SELECT * FROM ranked WHERE rn = 1 AND started_at >= ${bind(pgTimestamp(range.lo))}::timestamp\n)`
    )
    stage = 'picked'
  }

  /* ---- stage 3: one row per array item (§8.3) — always after dedupe ---- */

  if (spec.grain === 'element') {
    const src = spec.element_source!
    let arr: string
    if (src.encoding === 'json_string') {
      // JSON stored as text (§5.1). A broken value like '[object Object]' makes
      // the row expand to nothing instead of failing the whole query.
      // pg_input_is_valid needs Postgres 16; production is on 17.6.
      const asText = rawText(src, stage)
      arr =
        `CASE WHEN pg_input_is_valid(${asText}, 'jsonb') AND jsonb_typeof((${asText})::jsonb) = 'array'
              THEN (${asText})::jsonb ELSE '[]'::jsonb END`
    } else {
      const asJson = `${stage}.${src.col} #> ${bind(src.path ?? [])}::text[]`
      arr = `CASE WHEN jsonb_typeof(${asJson}) = 'array' THEN ${asJson} ELSE '[]'::jsonb END`
    }
    ctes.push(
      `expanded AS (\n  SELECT ${stage}.*, elem\n  FROM ${stage}\n  CROSS JOIN LATERAL jsonb_array_elements(${arr}) AS elem\n)`
    )
    stage = 'expanded'
  }

  /* ---- stage 4: the answer ---- */

  const t = stage
  const bucket = spec.bucket === 'none' ? 'none' : spec.bucket === 'auto' ? autoBucket(range.days) : spec.bucket
  // with companions the scan is shared, so nobody's own filter can narrow it —
  // each one becomes a FILTER on its own columns instead
  const shared = opts.companions?.length ? [] : spec.having
  const post = conjunction(shared, t)

  const dimExpr = spec.dimension
    ? spec.dimension.case_insensitive
      ? `lower(${cleanText(spec.dimension.field, t)})`
      : cleanText(spec.dimension.field, t)
    : null
  if (dimExpr && !spec.dimension!.include_empty) post.push(`${dimExpr} IS NOT NULL`)

  /** The columns one chart contributes to a shared scan. */
  const aggregateColumns = (
    agg: Spec['agg'],
    having: Spec['having'],
    suffix: string
  ): string[] => {
    const aggField = agg.field
    const numericFn = ['sum', 'avg', 'min', 'max', 'stddev', 'p50', 'p90', 'p95'].includes(agg.fn)
    const present = !aggField
      ? 'TRUE'
      : agg.fn === 'rate'
        ? `(${boolean(aggField, t, true)} OR ${boolean(aggField, t, false)})`
        : numericFn
          ? `${numeric(aggField, t)} IS NOT NULL`
          : `${cleanText(aggField, t)} IS NOT NULL`

    // a companion's own filter cannot go in the WHERE — the scan is shared —
    // so it rides along on every aggregate it belongs to
    const own = having.length ? conjunction(having, t).join(' AND ') : null
    const predicate = (extra?: string) => [own, extra].filter(Boolean).join(' AND ')
    /** `FILTER (WHERE TRUE)` is just noise; leave it out when nothing narrows. */
    const filter = (extra?: string) => {
      const where = predicate(extra)
      return where ? ` FILTER (WHERE ${where})` : ''
    }
    const and = (extra?: string) => predicate(extra) || 'TRUE'

    let value: string
    switch (agg.fn) {
      case 'count':
        value = `count(*)${filter()}`
        break
      case 'count_distinct':
        value = `count(DISTINCT ${cleanText(aggField!, t)})${filter()}`
        break
      case 'rate': {
        const hit = boolean(aggField!, t, agg.match)
        const denom = agg.denominator === 'all_rows' ? 'TRUE' : present
        value =
          `(count(*) FILTER (WHERE ${and(hit)}))::numeric / ` +
          `NULLIF(count(*) FILTER (WHERE ${and(denom)}), 0)`
        break
      }
      case 'p50': case 'p90': case 'p95': {
        const q = { p50: 0.5, p90: 0.9, p95: 0.95 }[agg.fn]
        value = `percentile_cont(${q}) WITHIN GROUP (ORDER BY ${numeric(aggField!, t)})${filter()}`
        break
      }
      default:
        value = `${agg.fn}(${numeric(aggField!, t)})${filter()}`
    }

    return [
      `${value} AS value${suffix}`,
      `count(*)${filter()} AS n_rows${suffix}`,
      `count(*) FILTER (WHERE ${and(present)}) AS n_nonnull${suffix}`,
    ]
  }

  const meta: Built['meta'] = {
    bucket,
    filtersAfterDedupe: spec.having.length > 0,
    rangeUtc: { from: pgTimestamp(range.lo), to: pgTimestamp(range.hi) },
    lookbackDays: range.lookbackDays,
  }

  // a function, not a string: a breakdown-over-time chart pushes one more CTE
  // below (the top-N category list) after this point, and a plain string
  // captured here would silently miss it
  const withClause = () => `WITH ${ctes.join(',\n')}\n`

  if (target !== 'aggregate') {
    // reuse `post`, don't recompute conjunction(spec.having, t): every `bind()`
    // inside `condition()` pushes a new SQL parameter as a side effect, so
    // calling it again here bound the same having-filter a second time under
    // a fresh, unused param index — harmless while `having` was empty (the
    // common case before dashboard filters reached drill/export), but the
    // moment a real filter chip was active, `checkEveryParamIsUsed` caught the
    // orphaned first copy and rejected the whole query as a compiler bug.
    // `post` already carries the dimension-not-null condition (pushed above)
    const rowFilters = [...post]
    if (opts.dimensionValue !== undefined && dimExpr) {
      rowFilters.push(`${dimExpr} IS NOT DISTINCT FROM ${bind(opts.dimensionValue)}`)
    }
    if (opts.cursor) {
      rowFilters.push(`(${t}.started_at, ${t}.id) < (${bind(opts.cursor.startedAt)}::timestamp, ${bind(opts.cursor.id)}::uuid)`)
    }
    const cols = [
      `${t}.id`, `${t}.call_id`, `${t}.customer_number`, `${t}.started_at`,
      `${t}.call_ended_at`,
      // duration_seconds is a DDL default computed at INSERT, when the call has
      // not ended — so it is NULL on most rows, and the drill list showed "—"
      // for the length of calls the chart had just measured in minutes. Fall
      // back to the same subtraction the charts use.
      `coalesce(${t}.duration_seconds,` +
        ` CASE WHEN ${t}.call_ended_at > ${t}.started_at` +
        ` THEN EXTRACT(epoch FROM (${t}.call_ended_at - ${t}.started_at)) END) AS duration_seconds`,
      `${t}.call_ended_reason`,
      ...(target === 'export' ? [`${t}.recording_url`] : []),
      ...(dimExpr ? [`${dimExpr} AS series`] : []),
    ]
    const sql =
      `${withClause()}SELECT ${cols.join(', ')}\n` +
      `FROM ${t}\n` +
      (rowFilters.length ? `WHERE ${rowFilters.join('\n  AND ')}\n` : '') +
      `ORDER BY ${t}.started_at DESC NULLS LAST, ${t}.id DESC\n` +
      `LIMIT ${bind(Math.min(opts.limit ?? 200, target === 'export' ? 5000 : 500))}`
    checkEveryParamIsUsed(sql, params)
    return { sql, params, meta }
  }

  const selected: string[] = []
  const grouped: string[] = []
  if (bucket !== 'none') {
    selected.push(`date_trunc(${bind(bucket)}, ${t}.started_local) AS bucket`)
    grouped.push('1')
  }
  // a breakdown WITHOUT a time bucket gets its LIMIT further down, applied
  // directly to the query's own ORDER BY value DESC — cheap, no second pass.
  // A breakdown WITH a time bucket can't use that trick: LIMIT there would cut
  // off arbitrary (bucket, category) pairs, silently dropping some days'
  // categories and keeping others'. This comment used to claim "the schema
  // already caps the breakdown at 50" for that case, but nothing did — an
  // agent with a near-unique-per-row field (30,000+ distinct values) turned
  // one chart into a multi-second full scan and an unrenderable legend, and
  // every other chart in the same dashboard request waited behind it. Rank
  // categories by row count first, keep the top `spec.dimension.limit`, fold
  // the rest into one literal '(other)' bucket — same row count either way,
  // bounded number of series.
  let seriesExpr = dimExpr
  if (bucket !== 'none' && dimExpr && spec.dimension) {
    ctes.push(
      `top_series AS (\n` +
        `  SELECT ${dimExpr} AS series\n` +
        `  FROM ${t}\n` +
        (post.length ? `  WHERE ${post.join('\n    AND ')}\n` : '') +
        `  GROUP BY 1\n` +
        `  ORDER BY count(*) DESC\n` +
        `  LIMIT ${bind(spec.dimension.limit)}\n` +
        `)`
    )
    seriesExpr = `(CASE WHEN (${dimExpr}) IN (SELECT series FROM top_series) THEN (${dimExpr}) ELSE '(other)' END)`
  }
  if (dimExpr) {
    selected.push(`${seriesExpr} AS series`)
    grouped.push(String(grouped.length + 1))
  }
  const members = opts.companions?.length
    ? opts.companions.map((c, i) => ({ agg: c.agg, having: c.having, suffix: `_${i}` }))
    : [{ agg: spec.agg, having: shared.length ? [] : spec.having, suffix: '' }]
  for (const m of members) selected.push(...aggregateColumns(m.agg, m.having, m.suffix))

  // limit the categories, not the rows: with a time bucket the schema already
  // caps the breakdown at 50, and cutting rows there would drop whole days
  // a LIMIT without an ORDER BY returns arbitrary rows, so a shared scan orders
  // by the first chart's value — the categories are the same for all of them
  const valueAlias = opts.companions?.length ? 'value_0' : 'value'
  const order = bucket !== 'none' ? 'ORDER BY 1' : dimExpr ? `ORDER BY ${valueAlias} DESC NULLS LAST` : ''
  const limit = bucket === 'none' && spec.dimension ? `\nLIMIT ${bind(spec.dimension.limit)}` : ''

  const sql =
    `${withClause()}SELECT ${selected.join(', ')}\n` +
    `FROM ${t}\n` +
    (post.length ? `WHERE ${post.join('\n  AND ')}\n` : '') +
    (grouped.length ? `GROUP BY ${grouped.join(', ')}\n` : '') +
    order +
    limit

  checkEveryParamIsUsed(sql, params)
  return { sql, params, meta }
}

/**
 * Postgres rejects a statement carrying a parameter it never sees, so a
 * parameter bound down one branch and referenced down another fails at run time
 * rather than at build time. Catch it here, where the message can name itself.
 */
function checkEveryParamIsUsed(sql: string, params: unknown[]): void {
  for (let n = 1; n <= params.length; n++) {
    if (!new RegExp(`\\$${n}(?![0-9])`).test(sql)) {
      throw new InternalSpecError(`parameter $${n} was bound but never used — the query would be rejected`)
    }
  }
}

/** Every column name this module is willing to write into SQL. Used by the tests. */
export const ALLOWED_IDENTIFIERS = new Set<string>([...JSON_COLS, ...TEXT_COLS, ...NUMERIC_COLS])


/* ------------------------------------------------------- one scan, many charts */

/**
 * Turns a dashboard into as few statements as it can be answered in.
 *
 * Measured against this database, a chart's SQL costs almost nothing — `SELECT
 * 1` takes 312ms and a real chart 262ms, so what a dashboard costs is round
 * trips to another region, multiplied by the number of charts. Eight of the
 * twelve starter charts read the same rows with the same rules and differ only
 * in what they add up, so they become one statement with more columns.
 *
 * Charts that genuinely differ — a different grain, a breakdown, a time bucket —
 * still get their own statement, because they read different rows.
 */
export function planDashboardQueries(
  entries: { id: string; spec: Spec }[],
  ctx: Ctx
): { sql: string; params: unknown[]; meta: Built['meta']; members: string[] }[] {
  const groups = new Map<string, { id: string; spec: Spec }[]>()
  for (const entry of entries) {
    const key = baseSignature(entry.spec)
    const group = groups.get(key)
    if (group) group.push(entry)
    else groups.set(key, [entry])
  }

  return [...groups.values()].map((group) => {
    const built = buildQuery(
      group[0].spec,
      ctx,
      'aggregate',
      // one member is just a chart; the companion form only earns its keep
      // when there is something to share the scan with
      group.length > 1
        ? { companions: group.map((g) => ({ id: g.id, agg: g.spec.agg, having: g.spec.having })) }
        : {}
    )
    return { ...built, members: group.map((g) => g.id) }
  })
}

/**
 * Everything that decides which rows a chart reads. Two charts with the same
 * signature can share one scan; the calculation and the chart's own filter are
 * deliberately absent, because those become columns rather than predicates.
 */
function baseSignature(spec: Spec): string {
  return JSON.stringify([
    spec.source, spec.grain, spec.dedupe, spec.element_source, spec.dimension,
    spec.bucket, spec.range, spec.time_of_day, spec.days_of_week,
    spec.include_live_calls, spec.exclude_environments, spec.sentinels, spec.filters,
  ])
}
