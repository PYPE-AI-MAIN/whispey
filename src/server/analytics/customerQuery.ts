/**
 * Overview charts for a customer-held project. The customer database is plain
 * PostgREST, so there is no SQL to run: the call rows come through the data
 * plane and are aggregated here. Covers what the starter charts use — counts,
 * sum/avg/min/max/percentiles of a numeric column, an optional day/week/month
 * bucket or one text breakdown, and eq/in/not_in-style filters. Anything else is
 * refused per chart, never answered differently from Pype's own SQL.
 */
import type { Spec, FilterNode, Ref } from './spec'
import { NUMERIC_COL_SET, TEXT_COLS } from './spec'
import { SpecError, resolveRange, pgTimestamp, wallClock, type Ctx, type Built } from './buildQuery'
import type { DataPlane, Row } from '@/server/data-plane'

/** Customer rows are read in full and aggregated here, so a range is capped rather than allowed to pull the table. */
export const MAX_CUSTOMER_ROWS = 50_000

const TEXT = new Set<string>(TEXT_COLS)
const AGG_FNS = new Set(['count', 'sum', 'avg', 'min', 'max', 'p50', 'p90', 'p95'])
const OPS = new Set(['eq', 'neq', 'in', 'not_in', 'is_empty', 'is_not_empty', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with'])
const SENTINELS = (s: Spec) => new Set(s.sentinels.map((v) => v.toLowerCase()))
const unsupported = (what: string): never => {
  throw new SpecError(`${what} is not available for projects whose call data is held by the customer yet`)
}

function walk(nodes: FilterNode[], fn: (r: Ref, op: string) => void): void {
  for (const n of nodes) {
    if ('children' in n) walk(n.children, fn)
    else fn(n.field, n.op)
  }
}

/** Refuses a spec the aggregator cannot answer exactly as Pype's SQL would. */
export function assertSupported(spec: Spec, ctx: Ctx): void {
  if (spec.grain !== 'interaction' || spec.source !== 'voice') unsupported('This chart')
  if (spec.time_of_day || spec.days_of_week?.length) unsupported('Time-of-day and day-of-week filters')
  if (!AGG_FNS.has(spec.agg.fn)) unsupported(`"${spec.agg.fn}"`)
  const plain = (r: Ref | undefined, kind: 'num' | 'text' | 'any') => {
    if (!r) return
    if (ctx.deniedFields.has(r.col)) throw new SpecError(`no permission for ${r.col}`)
    const ok = !r.path?.length && (kind === 'num' ? NUMERIC_COL_SET.has(r.col) : kind === 'text' ? TEXT.has(r.col) : TEXT.has(r.col) || NUMERIC_COL_SET.has(r.col))
    if (!ok) unsupported(`The field ${r.col}${r.path?.length ? '.' + r.path.join('.') : ''}`)
  }
  plain(spec.agg.field, spec.agg.fn === 'count' ? 'any' : 'num')
  plain(spec.dimension?.field, 'text')
  for (const list of [spec.filters, spec.having]) {
    walk(list, (r, op) => {
      if (!OPS.has(op)) unsupported(`The filter "${op}"`)
      plain(r, 'any')
    })
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const utcMs = (v: unknown): number | null => (typeof v === 'string' ? Date.parse(v.endsWith('Z') ? v : `${v}Z`) : null)

/** The same values buildQuery's COLUMN_EXPRESSIONS compute. */
function numeric(row: Row, col: string): number | null {
  if (col === 'total_cost') {
    const parts = [row.total_llm_cost, row.total_tts_cost, row.total_stt_cost].map(num)
    return parts.every((p) => p === null) ? null : parts.reduce<number>((a, p) => a + (p ?? 0), 0)
  }
  if (col === 'call_duration_seconds') {
    const a = utcMs(row.call_started_at)
    const b = utcMs(row.call_ended_at)
    return a !== null && b !== null && b > a ? (b - a) / 1000 : null
  }
  return num(row[col])
}

function text(row: Row, col: string, sentinels: Set<string>): string | null {
  const v = row[col]
  if (v === null || v === undefined) return null
  const t = String(v).trim()
  return sentinels.has(t.toLowerCase()) ? null : t
}

function matches(node: FilterNode, row: Row, sentinels: Set<string>): boolean {
  if ('children' in node) {
    const each = (c: FilterNode) => matches(c, row, sentinels)
    return node.op === 'and' ? node.children.every(each) : node.children.some(each)
  }
  const col = node.field.col
  const t = text(row, col, sentinels)
  const list = (Array.isArray(node.value) ? node.value : [node.value]).map(String)
  switch (node.op) {
    case 'is_empty': return t === null
    case 'is_not_empty': return t !== null
    case 'eq': return t === String(node.value)
    case 'neq': return t !== String(node.value)
    case 'in': return t !== null && list.includes(t)
    case 'not_in': return t === null || !list.includes(t)
    case 'contains': return t !== null && t.toLowerCase().includes(String(node.value).toLowerCase())
    case 'starts_with': return t !== null && t.toLowerCase().startsWith(String(node.value).toLowerCase())
    default: {
      const n = numeric(row, col)
      const v = Number(node.value)
      if (n === null) return false
      return node.op === 'gt' ? n > v : node.op === 'gte' ? n >= v : node.op === 'lt' ? n < v : n <= v
    }
  }
}

function percentile(sorted: number[], q: number): number {
  const at = (sorted.length - 1) * q
  const lo = Math.floor(at)
  return sorted[lo] + (sorted[Math.ceil(at)] - sorted[lo]) * (at - lo)
}

function aggregate(rows: Row[], agg: Spec['agg']): { value: number | null; n_rows: number; n_nonnull: number } {
  const col = agg.field?.col
  const vals = agg.fn === 'count' ? [] : rows.map((r) => numeric(r, col!)).filter((v): v is number => v !== null)
  const n_nonnull = !col ? rows.length : agg.fn === 'count' ? rows.filter((r) => (NUMERIC_COL_SET.has(col) ? numeric(r, col) !== null : r[col] != null)).length : vals.length
  let value: number | null = null
  if (agg.fn === 'count') value = rows.length
  else if (vals.length) {
    const sorted = [...vals].sort((a, b) => a - b)
    value =
      agg.fn === 'sum' ? vals.reduce((a, b) => a + b, 0)
      : agg.fn === 'avg' ? vals.reduce((a, b) => a + b, 0) / vals.length
      : agg.fn === 'min' ? sorted[0]
      : agg.fn === 'max' ? sorted[sorted.length - 1]
      : percentile(sorted, { p50: 0.5, p90: 0.9, p95: 0.95 }[agg.fn as 'p50' | 'p90' | 'p95'])
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

export type CustomerRun = { rows: Record<string, unknown>[]; meta: Built['meta'] }

/** What buildQuery's SQL would have returned for this spec, from the customer's rows. */
export function aggregateCustomerRows(all: Row[], spec: Spec, ctx: Ctx): CustomerRun {
  const range = resolveRange(spec, ctx)
  const sentinels = SENTINELS(spec)
  const lo = range.lo.getTime()
  const hi = range.hi.getTime()
  const scanned = all.filter((r) => {
    const at = utcMs(r.call_started_at)
    return (
      at !== null && at >= lo && at < hi &&
      (spec.include_live_calls || (r.wcall_event ?? 'call_ended') === 'call_ended') &&
      !(spec.exclude_environments.length && spec.exclude_environments.includes(String(r.environment ?? ''))) &&
      spec.filters.every((f) => matches(f, r, sentinels))
    )
  })
  const kept = scanned.filter((r) => spec.having.every((f) => matches(f, r, sentinels)))

  const bucket = spec.bucket === 'auto' ? (range.days <= 2 ? 'hour' : range.days <= 31 ? 'day' : range.days <= 120 ? 'week' : 'month') : spec.bucket
  const keyed = new Map<string, { bucket?: string; series?: string; rows: Row[] }>()
  for (const r of kept) {
    const series = spec.dimension ? text(r, spec.dimension.field.col, sentinels) : null
    if (spec.dimension && series === null && !spec.dimension.include_empty) continue
    const b = bucket === 'none' ? undefined : truncate(wallClock(new Date(utcMs(r.call_started_at)!), ctx.tz), bucket)
    const s = spec.dimension ? (spec.dimension.case_insensitive ? series?.toLowerCase() ?? null : series) : undefined
    const key = `${b ?? ''}\u0000${s ?? ''}`
    const group = keyed.get(key) ?? { bucket: b, series: s ?? undefined, rows: [] }
    group.rows.push(r)
    keyed.set(key, group)
  }
  if (!spec.dimension && bucket === 'none' && keyed.size === 0) keyed.set('', { rows: [] })

  let out = [...keyed.values()].map((g) => ({
    // pg returns the zone-less bucket as an instant read in the server's zone; buildQuery.bucketText undoes that, so match it on a UTC server
    ...(g.bucket === undefined ? {} : { bucket: `${g.bucket.replace(' ', 'T')}.000Z` }),
    ...(spec.dimension ? { series: g.series ?? null } : {}),
    ...aggregate(g.rows, spec.agg),
  }))
  if (bucket !== 'none') out.sort((a, b) => String((a as { bucket?: string }).bucket).localeCompare(String((b as { bucket?: string }).bucket)))
  else if (spec.dimension) out = out.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)).slice(0, spec.dimension.limit)

  return {
    rows: out,
    meta: {
      bucket,
      filtersAfterDedupe: spec.having.length > 0,
      rangeUtc: { from: pgTimestamp(range.lo), to: pgTimestamp(range.hi) },
      lookbackDays: 0,
    },
  }
}

/** One fetch per request, shared by every chart: the widest range any of them asks for. */
export async function loadCustomerRows(plane: DataPlane, specs: Spec[], ctx: Ctx): Promise<Row[]> {
  const ranges = specs.map((s) => resolveRange(s, ctx))
  const rows = await plane.callData.analyticsRows({
    agentIds: ctx.agentIds,
    from: pgTimestamp(new Date(Math.min(...ranges.map((r) => r.lo.getTime())))),
    to: pgTimestamp(new Date(Math.max(...ranges.map((r) => r.hi.getTime())))),
    maxRows: MAX_CUSTOMER_ROWS,
  })
  if (rows.length > MAX_CUSTOMER_ROWS) throw new SpecError(`This range has more than ${MAX_CUSTOMER_ROWS} calls; pick a shorter range`)
  return rows
}
