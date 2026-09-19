/**
 * Turning one result shape into whatever a chart type needs — Confluence
 * "Analytics Phase 1 and 2 — Build Spec" §7.1.
 *
 * The query builder emits exactly one shape: an optional time bucket, an
 * optional category, a value, and the two coverage counts. Every chart type is
 * a different way of drawing that, which is what "chart type is presentational"
 * has to mean in practice — a new chart type lands here, never in the SQL.
 */
import type { ResultRow, Widget } from '@/types/analytics'

export type Point = { x: string; [series: string]: string | number | null }

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Presentational only — seconds drawn as minutes. The query returns full precision. */
export function scaled(value: unknown, spec: Widget['spec']): number | null {
  const n = num(value)
  if (n === null) return null
  return n * (spec.display?.scale ?? 1)
}

/**
 * The one place a unit is attached to a number.
 *
 * It used to be two: this appended `display.unit`, and every caller *also*
 * appended '%' for a rate. A suggested rate chart sets `unit: '%'`, so it got
 * both — "2.8%%" on the card, in the tooltip, and down the axis.
 *
 * A rate is a percentage whatever `display.unit` says, so that is decided here
 * and callers simply print what they are given.
 */
export function formatValue(value: number | null, spec: Widget['spec']): string {
  if (value === null) return '—'
  const round = spec.display?.round ?? 1
  const unit = unitFor(spec)
  const text = value.toLocaleString(undefined, { minimumFractionDigits: round, maximumFractionDigits: round })
  if (!unit) return text
  return unit === '₹' ? `${unit}${text}` : `${text}${unit}`
}

/** What goes after the number — and for a rate that is '%', never twice. */
export function unitFor(spec: Widget['spec']): string {
  return isRate(spec) ? '%' : (spec.display?.unit ?? '')
}

/** A rate comes back as 0–1 and is read as a percentage. */
export function isRate(spec: Widget['spec']): boolean {
  return spec.agg?.fn === 'rate'
}

export function displayNumber(row: ResultRow | undefined, spec: Widget['spec']): number | null {
  const raw = scaled(row?.value, spec)
  if (raw === null) return null
  return isRate(spec) ? raw * 100 : raw
}

export type Shaped = {
  points: Point[]
  /** The lines or bars to draw. One unnamed entry when there is no breakdown. */
  seriesKeys: string[]
  /** Category axis title the card can show without naming a JSON path. */
  axis: 'time' | 'category' | 'none'
}

/**
 * Every category the field is known to produce, including the ones that scored
 * zero — §8.4. Also draws them in `categories` order, so the outcome order a
 * user configures in OutcomeOrderEditor is the order bars/legend actually show,
 * not just a dedupe tie-break.
 *
 * "emergency_escalated: 0" vanishing from a chart looks exactly like the field
 * not existing, which on a safety metric is the difference between "we checked
 * and it never happened" and "we were not looking". The catalog already knows
 * the value list, so this needs no change to the query.
 */
export function zeroFill(shaped: Shaped, categories: string[] | null | undefined): Shaped {
  if (shaped.axis !== 'category' || !categories?.length) return shaped
  const seen = new Set(shaped.points.map((p) => p.x))
  const missing = categories.filter((c) => !seen.has(c)).map((c) => ({ x: c, value: 0 }))
  const points = missing.length ? [...shaped.points, ...missing] : shaped.points
  const order = new Map(categories.map((c, i) => [c, i]))
  const sorted = [...points].sort((a, b) => (order.get(String(a.x)) ?? categories.length) - (order.get(String(b.x)) ?? categories.length))
  return { ...shaped, points: sorted }
}

export function shape(rows: ResultRow[], spec: Widget['spec']): Shaped {
  const hasBucket = rows.some((r) => r.bucket !== undefined && r.bucket !== null)
  const hasSeries = rows.some((r) => r.series !== undefined)
  const multiplier = isRate(spec) ? 100 : 1
  const value = (r: ResultRow) => {
    const v = scaled(r.value, spec)
    return v === null ? null : v * multiplier
  }

  if (hasBucket && hasSeries) {
    // a breakdown over time: one row per bucket, one key per category
    const byBucket = new Map<string, Point>()
    const keys = new Set<string>()
    for (const r of rows) {
      const x = String(r.bucket)
      const key = r.series ?? '(empty)'
      keys.add(key)
      const point = byBucket.get(x) ?? { x }
      point[key] = value(r)
      byBucket.set(x, point)
    }
    return { points: [...byBucket.values()], seriesKeys: [...keys], axis: 'time' }
  }

  if (hasBucket) {
    return { points: rows.map((r) => ({ x: String(r.bucket), value: value(r) })), seriesKeys: ['value'], axis: 'time' }
  }

  if (hasSeries) {
    return {
      points: rows.map((r) => ({ x: r.series ?? '(empty)', value: value(r) })),
      seriesKeys: ['value'],
      axis: 'category',
    }
  }

  return { points: [], seriesKeys: ['value'], axis: 'none' }
}

/**
 * "340 of 1,847 calls". An average over only the usable rows misleads unless the
 * card says which rows those were.
 */
export function coverage(rows: ResultRow[]): { used: number; total: number; pct: number } | null {
  if (!rows.length) return null
  const total = rows.reduce((sum, r) => sum + (num(r.n_rows) ?? 0), 0)
  const used = rows.reduce((sum, r) => sum + (num(r.n_nonnull) ?? 0), 0)
  if (total === 0) return null
  return { used, total, pct: Math.round((used / total) * 1000) / 10 }
}

/** Dates come back as instants; the bucket was already computed in the project's zone. */
export function formatBucket(x: string, bucket: string | undefined): string {
  const d = new Date(x)
  if (Number.isNaN(d.getTime())) return x
  if (bucket === 'hour') return d.toLocaleTimeString(undefined, { hour: 'numeric', hour12: true })
  if (bucket === 'month') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** A label nobody can read is worse than a truncated one (§5.5 — values over 200 characters). */
export function shortLabel(text: string, max = 24): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
