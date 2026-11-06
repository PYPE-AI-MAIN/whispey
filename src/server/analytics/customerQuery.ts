/**
 * Analytics for a customer-held project. The customer database is plain
 * PostgREST, so there is no Pype SQL to run: the call rows come through the data
 * plane and are evaluated here with the same rules buildQuery writes in SQL
 * (sentinels, phone identity, boolean encodings, numeric guard, dedupe, array
 * expansion, buckets in the project's zone). Parity with Pype's SQL is checked by
 * __tests__/analytics/customerParity.live.test.ts. Large projects use the
 * customer-side analytics_run function instead (see customerRun.ts).
 */
import type { Spec, FilterNode, Ref } from './spec'
import { NUMERIC_COL_SET, TEXT_COLS, JSON_COLS, ELEMENT_COL, BOOLEAN_VALUES } from './spec'
import { SpecError, resolveRange, pgTimestamp, wallClock, isPhoneField, type Ctx, type Built } from './buildQuery'
import type { DataPlane, Row } from '@/server/data-plane'
import { ANALYTICS_COLUMNS } from '@/server/data-plane/adapters/queryPlane'

/** Customer rows are read in full and aggregated here, so a range is capped rather than allowed to pull the table. */
export const MAX_CUSTOMER_ROWS = 50_000

const TEXT = new Set<string>(TEXT_COLS)
const JSON_SET = new Set<string>(JSON_COLS)
const unsupported = (what: string): never => {
  throw new SpecError(`${what} is not available for projects whose call data is held by the customer yet`)
}

function walk(nodes: FilterNode[], fn: (r: Ref, op: string) => void): void {
  for (const n of nodes) {
    if ('children' in n) walk(n.children, fn)
    else fn(n.field, n.op)
  }
}

/** Refuses what cannot be answered at all (another source) or is not permitted. Everything else in the spec language is evaluated. */
export function assertSupported(spec: Spec, ctx: Ctx): void {
  if (spec.source !== 'voice') unsupported('This chart')
  const check = (r: Ref | undefined) => {
    if (!r || ctx.deniedFields.size === 0) return
    const denied =
      ctx.deniedFields.has(r.col) ||
      (r.path ?? []).some((_, i) => ctx.deniedFields.has(`${r.col}.${r.path!.slice(0, i + 1).join('.')}`))
    if (denied) throw new SpecError(`no permission for ${r.path?.length ? `${r.col}.${r.path.join('.')}` : r.col}`)
  }
  for (const r of [spec.agg.field, spec.dimension?.field, spec.dedupe?.key.field, spec.dedupe?.outcome, spec.element_source]) check(r)
  for (const list of [spec.filters, spec.having]) walk(list, (r) => check(r))
}

/* ------------------------------------------------------------ value access */

type W = { r: Row; elem?: unknown; nCalls?: number }

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v) // PostgREST sends bigint/numeric columns as numbers; tolerate text
  return null
}
const utcMs = (v: unknown): number | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(/[zZ]|[+-]\d\d(:?\d\d)?$/.test(v) ? v : `${v}Z`)
  return Number.isNaN(t) ? null : t
}

/** jsonb's own text form: keys by length then bytes, `", "` and `": "` separators. */
function jsonbText(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonbText).join(', ')}]`
  if (v && typeof v === 'object') {
    const keys = Object.keys(v as object).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    return `{${keys.map((k) => `${JSON.stringify(k)}: ${jsonbText((v as Record<string, unknown>)[k])}`).join(', ')}}`
  }
  return JSON.stringify(v)
}

/** `#>`: walks objects by key and arrays by index. undefined = missing. */
function jsonAt(doc: unknown, path: string[] = []): unknown {
  let cur: unknown = doc
  for (const p of path) {
    if (Array.isArray(cur)) cur = /^-?\d+$/.test(p) ? cur.at(Number(p)) : undefined
    else if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[p]
    else return undefined
  }
  return cur
}

/** `#>>`: text of the value; JSON null and a missing key are both NULL. */
const jsonText = (v: unknown): string | null => {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return jsonbText(v)
}

/** The values buildQuery's COLUMN_EXPRESSIONS compute. */
function column(row: Row, col: string): number | string | null {
  if (col === 'total_cost') {
    const parts = [row.total_llm_cost, row.total_tts_cost, row.total_stt_cost].map(num)
    return parts.every((p) => p === null) ? null : parts.reduce<number>((a, p) => a + (p ?? 0), 0)
  }
  if (col === 'call_duration_seconds') {
    const a = utcMs(row.call_started_at)
    const b = utcMs(row.call_ended_at)
    return a !== null && b !== null && b > a ? (b - a) / 1000 : null
  }
  if (NUMERIC_COL_SET.has(col)) return num(row[col])
  const v = row[col]
  return v === undefined || v === null ? null : String(v)
}

const btrim = (s: string) => s.replace(/^ +| +$/g, '')

function rawText(w: W, ref: Ref): string | null {
  if (ref.col === ELEMENT_COL) return jsonText(jsonAt(w.elem, ref.path))
  if (JSON_SET.has(ref.col)) return jsonText(jsonAt(w.r[ref.col], ref.path))
  const v = column(w.r, ref.col)
  return v === null ? null : String(v)
}

type Env = { sentinels: Set<string> }

/** Text with the ways of writing "empty" collapsed to NULL. */
function cleanText(w: W, ref: Ref, env: Env): string | null {
  const raw = rawText(w, ref)
  if (raw === null) return null
  const t = btrim(raw)
  return env.sentinels.has(t.toLowerCase()) ? null : t
}

/** The same person however the number was written down (see buildQuery.identity). */
function identity(w: W, ref: Ref, env: Env): string | null {
  const t = cleanText(w, ref, env)
  if (t === null || !isPhoneField(ref)) return t
  return /^[+0-9()\s-]{10,15}$/.test(t) ? t.replace(/\D/g, '').slice(-10) : t
}

function numeric(w: W, ref: Ref, env: Env): number | null {
  if (NUMERIC_COL_SET.has(ref.col)) {
    const v = column(w.r, ref.col)
    return typeof v === 'number' ? v : null
  }
  const c = cleanText(w, ref, env)
  return c !== null && /^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$/.test(c) ? Number(c) : null
}

function bool(w: W, ref: Ref, want: boolean): boolean {
  const enc = BOOLEAN_VALUES[ref.boolean_encoding ?? 'true_false']
  const raw = rawText(w, ref)
  return raw !== null && (want ? enc.t : enc.f).includes(btrim(raw).toLowerCase())
}

/** SQL ILIKE with the value spliced into the pattern, so % and _ stay wildcards. */
function ilike(text: string, pattern: string): boolean {
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\' && i + 1 < pattern.length) re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    else if (c === '%') re += '.*'
    else if (c === '_') re += '.'
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`, 'is').test(text)
}

function condition(w: W, node: Extract<FilterNode, { field: Ref }>, env: Env): boolean {
  const { field, op, value } = node
  const t = () => cleanText(w, field, env)
  const isNumericCol = NUMERIC_COL_SET.has(field.col)
  const list = (Array.isArray(value) ? value : [value]).map(String)
  switch (op) {
    case 'is_empty': return t() === null
    case 'is_not_empty': return t() !== null
    case 'is_true': return bool(w, field, true)
    case 'is_false': return bool(w, field, false)
    // numeric real columns compare as numbers (5 equals 5.0, and total_cost is computed, so it has no text form)
    case 'eq': return isNumericCol ? numeric(w, field, env) !== null && numeric(w, field, env) === Number(value) : t() === String(value)
    case 'neq': return isNumericCol ? numeric(w, field, env) === null || numeric(w, field, env) !== Number(value) : t() !== String(value)
    case 'in': { const x = isNumericCol ? numeric(w, field, env) : t(); return x !== null && (isNumericCol ? list.some((v) => Number(v) === x) : list.includes(x as string)) }
    case 'not_in': { const x = isNumericCol ? numeric(w, field, env) : t(); return x === null || !(isNumericCol ? list.some((v) => Number(v) === x) : list.includes(x as string)) }
    case 'contains': { const x = t(); return x !== null && ilike(x, `%${String(value)}%`) }
    case 'starts_with': { const x = t(); return x !== null && ilike(x, `${String(value)}%`) }
    default: {
      const n = numeric(w, field, env)
      const v = Number(value)
      if (n === null) return false
      return op === 'gt' ? n > v : op === 'gte' ? n >= v : op === 'lt' ? n < v : n <= v
    }
  }
}

function matches(w: W, node: FilterNode, env: Env): boolean {
  if ('children' in node) {
    const each = (c: FilterNode) => matches(w, c, env)
    return node.op === 'and' ? node.children.every(each) : node.children.some(each)
  }
  return condition(w, node, env)
}

const hasElement = (nodes: FilterNode[]): boolean => {
  let found = false
  walk(nodes, (r) => { if (r.col === ELEMENT_COL) found = true })
  return found
}

/* --------------------------------------------------------------- aggregates */

function percentile(sorted: number[], q: number): number {
  const at = (sorted.length - 1) * q
  const lo = Math.floor(at)
  return sorted[lo] + (sorted[Math.ceil(at)] - sorted[lo]) * (at - lo)
}

function aggregate(rows: W[], agg: Spec['agg'], env: Env): { value: number | null; n_rows: number; n_nonnull: number } {
  const f = agg.field
  const numericFn = ['sum', 'avg', 'min', 'max', 'stddev', 'p50', 'p90', 'p95', 'sum_ceil_minutes'].includes(agg.fn)
  const present = (w: W): boolean => {
    if (!f) return true
    if (agg.fn === 'rate') return bool(w, f, true) || bool(w, f, false)
    if (numericFn) return numeric(w, f, env) !== null
    return cleanText(w, f, env) !== null
  }
  const n_nonnull = rows.filter(present).length
  let value: number | null = null
  if (agg.fn === 'count') value = rows.length
  else if (agg.fn === 'count_distinct') value = new Set(rows.map((w) => identity(w, f!, env)).filter((v) => v !== null)).size
  else if (agg.fn === 'rate') {
    const denom = agg.denominator === 'all_rows' ? rows.length : n_nonnull
    value = denom === 0 ? null : rows.filter((w) => bool(w, f!, agg.match)).length / denom
  } else {
    const vals = rows.map((w) => numeric(w, f!, env)).filter((v): v is number => v !== null)
    if (vals.length) {
      const sorted = [...vals].sort((a, b) => a - b)
      const sum = vals.reduce((a, b) => a + b, 0)
      if (agg.fn === 'sum') value = sum
      else if (agg.fn === 'avg') value = sum / vals.length
      else if (agg.fn === 'min') value = sorted[0]
      else if (agg.fn === 'max') value = sorted[sorted.length - 1]
      else if (agg.fn === 'sum_ceil_minutes') value = vals.reduce((a, v) => a + Math.ceil(v / 60), 0)
      else if (agg.fn === 'stddev') {
        const mean = sum / vals.length
        value = vals.length < 2 ? null : Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (vals.length - 1))
      } else value = percentile(sorted, { p50: 0.5, p90: 0.9, p95: 0.95 }[agg.fn as 'p50' | 'p90' | 'p95'])
    }
  }
  return { value, n_rows: rows.length, n_nonnull }
}

/** date_trunc on the project's wall clock; the result is `YYYY-MM-DD HH:MM:SS`. */
function truncate(wall: string, bucket: 'hour' | 'day' | 'week' | 'month'): string {
  if (bucket === 'hour') return `${wall.slice(0, 13)}:00:00`
  if (bucket === 'day') return `${wall.slice(0, 10)} 00:00:00`
  if (bucket === 'month') return `${wall.slice(0, 7)}-01 00:00:00`
  const d = new Date(`${wall.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return `${d.toISOString().slice(0, 10)} 00:00:00`
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/
const isoDow = (wall: string) => ((new Date(`${wall.slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7) + 1

/* ------------------------------------------------------------------ stages */

type Staged = { rows: W[]; bucket: 'none' | 'hour' | 'day' | 'week' | 'month'; env: Env; range: ReturnType<typeof resolveRange>; dim: ((w: W) => string | null) | null }

/** scan, dedupe, expand, post-filter: the rows a chart (or the list under it) is made of. */
function stage(all: Row[], spec: Spec, ctx: Ctx): Staged {
  const range = resolveRange(spec, ctx)
  const env: Env = { sentinels: new Set(spec.sentinels.map((v) => v.toLowerCase())) }
  const lo = range.loWithLookback.getTime()
  const hi = range.hi.getTime()
  const tod = spec.time_of_day
  if (tod && (!CLOCK.test(tod.from) || !CLOCK.test(tod.to))) throw new SpecError('time_of_day must be HH:MM')
  const dows = spec.days_of_week?.length && spec.days_of_week.length < 7 ? new Set(spec.days_of_week) : null
  if (hasElement(spec.filters)) throw new SpecError('pre-dedupe filters cannot read array items — put them in `having`')

  let rows: W[] = all
    .filter((r) => {
      const at = utcMs(r.call_started_at)
      if (at === null || at < lo || at >= hi) return false
      if (!spec.include_live_calls && (r.wcall_event ?? 'call_ended') !== 'call_ended') return false
      if (spec.exclude_environments.length && spec.exclude_environments.includes(String(r.environment ?? ''))) return false
      if (tod || dows) {
        const wall = wallClock(new Date(at), ctx.tz)
        if (tod) {
          const time = wall.slice(11)
          const a = time >= tod.from
          const b = time < tod.to
          if (!(tod.from > tod.to ? a || b : a && b)) return false
        }
        if (dows && !dows.has(isoDow(wall))) return false
      }
      if (spec.grain === 'entity' && spec.dedupe?.answered_only && !['completed', 'transfer_failed'].includes(String(r.call_ended_reason))) return false
      return true
    })
    .map((r) => ({ r }))
    .filter((w) => spec.filters.every((f) => matches(w, f, env)))

  if (spec.grain === 'entity') {
    const d = spec.dedupe!
    if (d.winner === 'best_outcome' && !d.ranking?.length) throw new SpecError('best_outcome needs the agent outcome order')
    const groups = new Map<string, W[]>()
    for (const w of rows) {
      const key = identity(w, d.key.field, env)
      if (key === null && d.key.fallback === 'none') continue
      const part = `${w.r.agent_id}\u0000${key ?? `no-key-${w.r.call_id}`}`
      const g = groups.get(part)
      if (g) g.push(w)
      else groups.set(part, [w])
    }
    const rank = (w: W) => {
      const i = d.ranking!.indexOf(cleanText(w, d.outcome!, env) ?? '\u0000')
      return i < 0 ? Number.POSITIVE_INFINITY : i
    }
    const created = (w: W) => String(w.r.created_at ?? '')
    const cmp = (a: W, b: W) => {
      let c = 0
      if (d.winner === 'best_outcome') c = rank(a) - rank(b) || 0
      if (!c) {
        const x = created(a)
        const y = created(b)
        c = d.winner === 'first' ? (x < y ? -1 : x > y ? 1 : 0) : x < y ? 1 : x > y ? -1 : 0
      }
      if (!c) c = String(a.r.id) < String(b.r.id) ? -1 : String(a.r.id) > String(b.r.id) ? 1 : 0
      return c
    }
    const loStart = range.lo.getTime()
    rows = [...groups.values()]
      .map((g) => ({ ...[...g].sort(cmp)[0], nCalls: g.length }))
      .filter((w) => (utcMs(w.r.call_started_at) ?? 0) >= loStart)
  }

  if (spec.grain === 'element') {
    const src = spec.element_source!
    rows = rows.flatMap((w) => {
      let arr: unknown
      if (src.encoding === 'json_string') {
        const text = rawText(w, src)
        try { arr = text === null ? null : JSON.parse(text) } catch { arr = null }
      } else arr = jsonAt(w.r[src.col], src.path)
      return Array.isArray(arr) ? arr.map((elem) => ({ ...w, elem })) : []
    })
  }

  const bucket = spec.bucket === 'auto' ? (range.days <= 2 ? 'hour' : range.days <= 31 ? 'day' : range.days <= 120 ? 'week' : 'month') : spec.bucket
  const dim = spec.dimension
    ? (w: W) => {
        const v = cleanText(w, spec.dimension!.field, env)
        return spec.dimension!.case_insensitive && v !== null ? v.toLowerCase() : v
      }
    : null
  let kept = rows.filter((w) => spec.having.every((f) => matches(w, f, env)))
  if (dim && !spec.dimension!.include_empty) kept = kept.filter((w) => dim(w) !== null)
  return { rows: kept, bucket, env, range, dim }
}

export type CustomerRun = { rows: Record<string, unknown>[]; meta: Built['meta'] }

const startedLocal = (w: W, ctx: Ctx) => wallClock(new Date(utcMs(w.r.call_started_at)!), ctx.tz)

/** What buildQuery's SQL would have returned for this spec, from the customer's rows. */
export function aggregateCustomerRows(all: Row[], spec: Spec, ctx: Ctx): CustomerRun {
  const { rows, bucket, env, range, dim } = stage(all, spec, ctx)

  // a breakdown over time keeps the busiest categories and folds the rest (and the empty one) into '(other)'
  let top: Set<string> | null = null
  if (bucket !== 'none' && dim) {
    const counts = new Map<string, number>()
    for (const w of rows) {
      const s = dim(w)
      if (s !== null) counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    top = new Set([...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, spec.dimension!.limit).map(([k]) => k))
  }

  const keyed = new Map<string, { bucket?: string; series?: string | null; rows: W[] }>()
  for (const w of rows) {
    let series: string | null | undefined
    if (dim) {
      series = dim(w)
      if (top) series = series !== null && top.has(series) ? series : '(other)'
    }
    const b = bucket === 'none' ? undefined : truncate(startedLocal(w, ctx), bucket)
    const key = `${b ?? ''}\u0000${series ?? ''}\u0000${series === null ? 'n' : ''}`
    const group = keyed.get(key) ?? { bucket: b, series, rows: [] }
    group.rows.push(w)
    keyed.set(key, group)
  }
  if (!spec.dimension && bucket === 'none' && keyed.size === 0) keyed.set('', { rows: [] })

  let out = [...keyed.values()].map((g) => ({
    // pg returns the zone-less bucket as an instant read in the server's zone; buildQuery.bucketText undoes that, so match it on a UTC server
    ...(g.bucket === undefined ? {} : { bucket: `${g.bucket.replace(' ', 'T')}.000Z` }),
    ...(spec.dimension ? { series: g.series ?? null } : {}),
    ...aggregate(g.rows, spec.agg, env),
  }))
  if (bucket !== 'none') {
    out.sort((a, b) => String((a as { bucket?: string }).bucket).localeCompare(String((b as { bucket?: string }).bucket)) || String((a as { series?: string }).series ?? '').localeCompare(String((b as { series?: string }).series ?? '')))
  } else if (spec.dimension) out = out.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)).slice(0, spec.dimension.limit)

  return { rows: out, meta: metaFor(spec, ctx) }
}

/** What the card shows next to a number: the bucket size, the range read and whether filters ran after dedupe. */
export function metaFor(spec: Spec, ctx: Ctx): Built['meta'] {
  const range = resolveRange(spec, ctx)
  const bucket = spec.bucket === 'auto' ? (range.days <= 2 ? 'hour' : range.days <= 31 ? 'day' : range.days <= 120 ? 'week' : 'month') : spec.bucket
  return {
    bucket,
    filtersAfterDedupe: spec.having.length > 0,
    rangeUtc: { from: pgTimestamp(range.lo), to: pgTimestamp(range.hi) },
    lookbackDays: range.lookbackDays,
  }
}

export type DrillOpts = {
  dimensionValue?: string | null
  bucketValue?: string
  cursor?: { startedAt: string; id: string }
  limit?: number
  target: 'drill' | 'export'
}

/** The calls behind a bar (or a whole export page): same rows the chart counted, newest first, keyset-paged. */
export function drillCustomerRows(all: Row[], spec: Spec, ctx: Ctx, opts: DrillOpts): { rows: Record<string, unknown>[] } {
  const { rows, bucket, dim } = stage(all, spec, ctx)
  let list = rows
  if (opts.dimensionValue !== undefined && dim) list = list.filter((w) => dim(w) === opts.dimensionValue)
  if (opts.bucketValue !== undefined && bucket !== 'none') list = list.filter((w) => truncate(startedLocal(w, ctx), bucket) === opts.bucketValue)
  const at = (w: W) => utcMs(w.r.call_started_at)!
  const id = (w: W) => String(w.r.id)
  list = [...list].sort((a, b) => at(b) - at(a) || (id(a) < id(b) ? 1 : id(a) > id(b) ? -1 : 0))
  if (opts.cursor) {
    const c = Date.parse(opts.cursor.startedAt)
    list = list.filter((w) => at(w) < c || (at(w) === c && id(w) < opts.cursor!.id))
  }
  const limit = Math.min(opts.limit ?? 200, opts.target === 'export' ? 5000 : 500)
  return {
    rows: list.slice(0, limit).map((w) => {
      const computed = column(w.r, 'call_duration_seconds')
      return {
        id: w.r.id,
        call_id: w.r.call_id,
        agent_id: w.r.agent_id,
        customer_number: w.r.customer_number ?? null,
        started_at: new Date(at(w)).toISOString(),
        call_ended_at: w.r.call_ended_at ?? null,
        duration_seconds: w.r.duration_seconds ?? computed,
        call_ended_reason: w.r.call_ended_reason ?? null,
        ...(opts.target === 'export' ? { recording_url: w.r.recording_url ?? null } : {}),
        ...(dim ? { series: dim(w) } : {}),
        ...(opts.target === 'drill' && spec.grain === 'entity' ? { calls_in_window: w.nCalls } : {}),
      }
    }),
  }
}

/* ----------------------------------------------------------------- loading */

// what every fetch selects plus the two computed numbers; a field outside it (and outside columnsFor's JSON documents) would read as empty and give silent wrong numbers
export const FETCHED = new Set([...ANALYTICS_COLUMNS.split(','), 'total_cost', 'call_duration_seconds'])

/** The columns a set of specs reads: the base set plus the JSON documents they open. */
export function columnsFor(specs: Spec[], target: 'aggregate' | 'drill' | 'export' = 'aggregate'): string {
  const cols = new Set<string>(ANALYTICS_COLUMNS.split(','))
  for (const s of specs) {
    if (s.grain === 'entity') cols.add('created_at')
    const refs: Ref[] = []
    const push = (r: Ref | undefined) => r && refs.push(r)
    ;[s.agg.field, s.dimension?.field, s.dedupe?.key.field, s.dedupe?.outcome, s.element_source].forEach(push)
    for (const list of [s.filters, s.having]) walk(list, (r) => refs.push(r))
    for (const r of refs) if (JSON_SET.has(r.col)) cols.add(r.col)
  }
  if (target === 'export') cols.add('recording_url')
  return [...cols].join(',')
}

/** Fetched rows are reused for a few seconds: a dashboard fires several requests (charts, drill, overview) over the same window. */
export const ROWS_CACHE_MS = 20_000
const MAX_CACHED = 6
const cache = new Map<string, { at: number; rows: Promise<Row[]> }>()
export const clearCustomerRowsCache = () => cache.clear()

/** One fetch per request, shared by every chart: the widest range any of them asks for. */
export async function loadCustomerRows(plane: DataPlane, specs: Spec[], ctx: Ctx, opts: { target?: 'aggregate' | 'drill' | 'export'; now?: () => number } = {}): Promise<Row[]> {
  const ranges = specs.map((s) => resolveRange(s, ctx))
  const from = pgTimestamp(new Date(Math.min(...ranges.map((r) => r.loWithLookback.getTime()))))
  const to = pgTimestamp(new Date(Math.max(...ranges.map((r) => r.hi.getTime()))))
  const columns = columnsFor(specs, opts.target)
  const now = (opts.now ?? Date.now)()
  const key = JSON.stringify([ctx.projectId, [...ctx.agentIds].sort(), from, to, columns])
  const hit = cache.get(key)
  if (hit && now - hit.at < ROWS_CACHE_MS) return hit.rows
  const rows = plane.callData
    .analyticsRows({ agentIds: ctx.agentIds, from, to, maxRows: MAX_CUSTOMER_ROWS, columns })
    .then((r) => {
      if (r.length > MAX_CUSTOMER_ROWS) throw new SpecError(`This range has more than ${MAX_CUSTOMER_ROWS} calls; pick a shorter range`)
      return r
    })
  cache.set(key, { at: now, rows })
  rows.catch(() => cache.delete(key)) // a failure is never cached
  for (const [k, v] of cache) if (cache.size > MAX_CACHED || now - v.at >= ROWS_CACHE_MS) cache.delete(k)
  return rows
}
