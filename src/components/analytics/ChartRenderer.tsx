/**
 * Drawing a result — Confluence "Analytics Phase 1 and 2 — Build Spec" §7.1.
 *
 * Every chart type here reads the same three columns the query builder emits.
 * Adding a new one is a new branch in this file and nothing else; if a chart
 * type ever seems to need its own SQL, the answer is that it is a shape the
 * engine does not produce, not a special case in the compiler.
 */
'use client'
import React from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { ChartKind, ResultRow } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'
import { shape, zeroFill, formatValue, formatBucket, shortLabel, displayNumber, unitFor } from './chartData'

/** Distinguishable in both themes, and still distinguishable for the most common colour blindness. */
/**
 * Fixed 8-color order from the dataviz skill (references/palette.md), checked
 * to stay tellable-apart even for colorblind readers. Don't reorder or swap a
 * slot — that breaks the guarantee. A 9th series folds into "Other" instead of
 * getting a new color.
 */
export const SERIES_COLORS = [
  'var(--analytics-series-1)', 'var(--analytics-series-2)', 'var(--analytics-series-3)', 'var(--analytics-series-4)',
  'var(--analytics-series-5)', 'var(--analytics-series-6)', 'var(--analytics-series-7)', 'var(--analytics-series-8)',
  'var(--analytics-series-9)', 'var(--analytics-series-10)', 'var(--analytics-series-11)', 'var(--analytics-series-12)',
]

/**
 * A series' colour. Each of the first 12 gets its own; past that, and for the
 * catch-all `(other)` / `(empty)` series, a neutral grey, so two different
 * values never share a colour just because the palette wrapped.
 */
export const seriesColor = (key: string, i: number): string =>
  key === '(other)' || key === '(empty)' || i >= SERIES_COLORS.length ? 'var(--analytics-series-other)' : SERIES_COLORS[i]

/** Above this a pie stops meaning anything; the card offers a bar instead. */
export const PIE_MAX_SLICES = 8

const axisStyle = { fontSize: 11, fill: 'currentColor' } as const

/**
 * Pulls our category value out of a recharts click event.
 *
 * A `<Bar onClick>` event is the bar's own render props, which already has an
 * `x` — the bar's pixel position, a number. Our real data (`{ x: "general_callback" }`)
 * sits nested under `datum.payload` instead. Reading `datum.x` directly picked
 * up that pixel number, failed the string check, and returned null — every bar
 * drilled into "no value" while the tooltip (which reads payload correctly)
 * still showed the right name. So: check `.payload.x` first, and fall back to
 * `.x` for shapes like Pie that put it there directly.
 */
export const readX = (datum: unknown): string | null => {
  if (!datum || typeof datum !== 'object') return null
  const payload = (datum as { payload?: unknown }).payload
  const payloadX = payload && typeof payload === 'object' ? (payload as { x?: unknown }).x : undefined
  const x = typeof payloadX === 'string' ? payloadX : (datum as { x?: unknown }).x
  if (typeof x !== 'string') return null
  return x === '(empty)' ? null : x
}
/**
 * What a click on a bar means. On a category chart the bar IS the value. On a
 * chart over time the bar's x is a time bucket, and only a stacked segment also
 * names a value; reading the bucket as the value found no calls at all.
 * `(other)` folds many values together, so it opens the whole bucket instead.
 */
export function drillTarget(datum: unknown, axis: string, seriesKey?: string): { value?: string | null; bucket?: string } {
  if (axis !== 'time') return { value: readX(datum) }
  const bucket = readX(datum) ?? undefined
  if (!seriesKey || seriesKey === 'value' || seriesKey === '(other)') return { bucket }
  return { value: seriesKey === '(empty)' ? null : seriesKey, bucket }
}

/**
 * How many ticks recharts' own `interval` prop should skip so a time axis
 * shows roughly `maxTicks` evenly-spaced labels instead of one per bucket.
 * recharts states `interval` as "render every Nth tick" (0 = every tick), so
 * this is the N that gets from however many buckets a chart has down to a
 * readable count — a 90-day daily chart at interval=0 crams 90 overlapping
 * date labels into the strip.
 */
export const timeTickInterval = (pointCount: number, maxTicks = 10): number =>
  Math.max(0, Math.ceil(pointCount / maxTicks) - 1)

/** Legend label formatters, at module scope so recharts isn't handed a fresh component every render. */
function pieLegendLabel(v: unknown) {
  return <span title={String(v)}>{shortLabel(String(v), 18)}</span>
}
function seriesLegendLabel(v: unknown) {
  return <span title={String(v)}>{shortLabel(String(v), 16)}</span>
}
const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: 12,
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
  },

} as const

export function ChartRenderer({
  kind, rows, spec, bucket, categories, onSelect, compact, short,
}: Readonly<{
  kind: ChartKind
  rows: ResultRow[]
  spec: SpecInput
  bucket?: string
  /** Every value this field is known to produce, so a zero is drawn rather than dropped. */
  categories?: string[] | null
  /** Clicking a bar or a slice opens the calls behind it. */
  onSelect?: (value?: string | null, bucket?: string) => void
  compact?: boolean
  /** A card only two grid rows tall: the big number has to come down a size. */
  short?: boolean
}>) {
  const shaped = zeroFill(shape(rows, spec), categories)
  const suffix = unitFor(spec)
  const shortLabelWidth = compact ? 10 : 18
  const tickFor = (x: string) => (shaped.axis === 'time' ? formatBucket(x, bucket) : shortLabel(x, shortLabelWidth))

  if (kind === 'kpi') return <Kpi rows={rows} spec={spec} short={short} compact={compact} />
  // a table with nothing to break down is just the number
  if (kind === 'table' && shape(rows, spec).axis === 'none') return <Kpi rows={rows} spec={spec} short={short} compact={compact} />

  // a chart type needs a shape to draw. Say which one is missing rather than
  // leaving an empty rectangle and no explanation.
  if (shaped.axis === 'none') {
    return <Notice>Choose something to split by, or a time breakdown, to draw this as a {kind}.</Notice>
  }
  if (kind === 'pie' && shaped.axis === 'time') {
    return <Notice>A pie cannot show a time breakdown. Split by a field instead, or use a bar or line.</Notice>
  }

  if (kind === 'table') return <Table shaped={shaped} spec={spec} bucket={bucket} onSelect={onSelect} />

  if (kind === 'pie') {
    if (shaped.points.length > PIE_MAX_SLICES) {
      return <Notice>{shaped.points.length} categories is too many for a pie. A bar chart reads better.</Notice>
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={shaped.points}
            dataKey="value"
            nameKey="x"
            innerRadius="45%"
            outerRadius="78%"
            paddingAngle={2}
            onClick={(slice: unknown) => onSelect?.(readX(slice))}
          >
            {shaped.points.map((p, i) => (
              <Cell key={p.x} fill={seriesColor(p.x, i)} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v: unknown) => formatValue(Number(v), spec)} />
          <Legend formatter={pieLegendLabel} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const Chart = kind === 'line' ? LineChart : BarChart
  // A horizontal label only gets one bar's width to fit in — fine for short
  // categories, but a real breakdown mixes short and long values and they
  // collide. Angle category labels only (time labels are already short and
  // even) so each gets its own diagonal space; the axis needs extra height
  // for that.
  const angleTicks = shaped.axis === 'category'
  // interval=0 (every tick) is right for a category axis — few values, each
  // one meaningful, and forcing all of them is what fixed the blank-label bug
  // above. A time axis uses timeTickInterval instead (see its own comment).
  const tickInterval = shaped.axis === 'time' ? timeTickInterval(shaped.points.length) : 0
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={shaped.points} margin={{ top: 8, right: 12, left: -12, bottom: angleTicks ? 28 : 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
        {/* interval={0} on categories: "preserveStartEnd" only promises the first/last
            tick — for the rest it guesses which labels would overlap, and with
            mixed-length category labels it sometimes guesses wrong and drops a label
            while still drawing its bar. Forcing every tick to render, plus angling them
            below, fixes both the missing label and the overlap. A time axis instead
            gets tickInterval, computed above from how many buckets there actually are. */}
        <XAxis
          dataKey="x"
          tickFormatter={tickFor}
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          interval={tickInterval}
          {...(angleTicks ? { angle: -35, textAnchor: 'end' as const, height: 56 } : {})}
        />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={44} unit={suffix || undefined} />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4, stroke: 'var(--border)' }}
          content={(p) => (
            <SeriesTooltip
              active={p.active}
              payload={p.payload as unknown as TooltipEntry[] | undefined}
              label={shaped.axis === 'time' ? formatBucket(String(p.label), bucket) : String(p.label)}
              spec={spec}
            />
          )}
        />
        {shaped.seriesKeys.length > 1 && (
          <Legend formatter={seriesLegendLabel} wrapperStyle={{ fontSize: 11 }} />
        )}
        {shaped.seriesKeys.map((key, i) =>
          kind === 'line' ? (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={seriesColor(key, i)}
              strokeWidth={2}
              dot={false}
              // a gap is a day with no calls, not a value of zero
              connectNulls={false}
            />
          ) : (
            <Bar
              key={key}
              dataKey={key}
              stackId={shaped.seriesKeys.length > 1 ? 'a' : undefined}
              fill={seriesColor(key, i)}
              radius={shaped.seriesKeys.length > 1 ? 0 : [4, 4, 0, 0]}
              // one bucket would otherwise render as a wall the width of the card
              maxBarSize={64}
              cursor={onSelect ? 'pointer' : undefined}
              onClick={(bar: unknown) => { const t = drillTarget(bar, shaped.axis, key); onSelect?.(t.value, t.bucket) }}
            />
          )
        )}
      </Chart>
    </ResponsiveContainer>
  )
}

type TooltipEntry = { name?: string | number; value?: number | string | null; color?: string }

/**
 * Hover card for a bar or line: every value that day, biggest first, each next to
 * its colour, then the total — so the card adds up to the bar the pointer is on.
 * Zeros and gaps are left out; a stacked bar can have a dozen empty values.
 */
function SeriesTooltip({ active, payload, label, spec }: Readonly<{ active?: boolean; payload?: TooltipEntry[]; label: string; spec: SpecInput }>) {
  if (!active || !payload?.length) return null
  const entries = payload
    .filter((e) => typeof e.value === 'number' && e.value !== 0)
    .sort((a, b) => Number(b.value) - Number(a.value))
  const total = entries.reduce((sum, e) => sum + Number(e.value), 0)
  return (
    <div style={tooltipStyle.contentStyle} className="max-w-[16rem] px-3 py-2 shadow-md">
      <div className="mb-1 font-medium">{label}</div>
      {entries.length === 0 && <div className="text-muted-foreground">Nothing</div>}
      {entries.map((e) => (
        <div key={String(e.name)} className="flex items-center gap-2 py-px">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: e.color }} />
          <span className="min-w-0 flex-1 truncate" title={String(e.name)}>{e.name === 'value' ? 'Value' : String(e.name)}</span>
          <span className="tabular-nums">{formatValue(Number(e.value), spec)}</span>
        </div>
      ))}
      {entries.length > 1 && isAdditive(spec) && (
        <div className="mt-1 flex items-center justify-between gap-2 border-t pt-1 font-medium" style={{ borderColor: 'var(--border)' }}>
          <span>Total</span>
          <span className="tabular-nums">{formatValue(total, spec)}</span>
        </div>
      )}
    </div>
  )
}

/** Counts and sums add up across a stack; averages, rates and percentiles do not. */
export const isAdditive = (spec: SpecInput): boolean => ['count', 'count_distinct', 'sum', 'sum_ceil_minutes'].includes(spec.agg.fn)

function sizeClass(short: boolean | undefined, compact: boolean | undefined): string {
  if (!short) return 'text-3xl'
  return compact ? 'text-xl' : 'text-2xl'
}

function Kpi({ rows, spec, short, compact }: Readonly<{ rows: ResultRow[]; spec: SpecInput; short?: boolean; compact?: boolean }>) {
  const value = displayNumber(rows[0], spec)
  return (
    <div className="flex h-full flex-col justify-center overflow-hidden">
      <div
        className={cn(
          'truncate font-semibold tabular-nums text-foreground',
          // `short` (h <= 2) alone isn't enough of a signal: on a NARROW card
          // too, the header's grain-label + definition line wraps onto a
          // second line (deliberately — it's allowed to wrap rather than
          // truncate into something unreadable), which eats into the same
          // fixed-height card's budget and left this box shorter than the
          // number's own line-height, clipped top and bottom by the
          // `overflow-hidden` above. One size further down guarantees room
          // even when that second header line shows up.
          sizeClass(short, compact),
          value === null && 'text-muted-foreground'
        )}
      >
        {value === null ? '—' : formatValue(value, spec)}
      </div>
    </div>
  )
}

// What the first column holds: the time bucket, or the category that was split on.
function firstColumnLabel(axis: string, bucket?: string, field?: string): string {
  if (axis === 'time') return bucket ? bucket.charAt(0).toUpperCase() + bucket.slice(1) : 'Time'
  const name = field?.split('.').pop()?.replaceAll('_', ' ').trim()
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Category'
}

function Table({
  shaped, spec, bucket, onSelect,
}: Readonly<{
  shaped: ReturnType<typeof shape>
  spec: SpecInput
  bucket?: string
  onSelect?: (value?: string | null, bucket?: string) => void
}>) {
  const isTime = shaped.axis === 'time'
  const num = (v: unknown) => (typeof v === 'number' ? v : null)
  // a Total only means something where values add up and there is more than one column
  const showTotal = shaped.seriesKeys.length > 1 && isAdditive(spec)
  const sum = (vals: unknown[]) => vals.reduce<number>((t, v) => t + (num(v) ?? 0), 0)
  // biggest column first: with a dozen dispositions the ones that matter are on screen
  const keys = [...shaped.seriesKeys].sort((a, b) => sum(shaped.points.map((p) => p[b])) - sum(shaped.points.map((p) => p[a])))
  const open = (value: string | null | undefined, x: string) => {
    if (!onSelect) return
    if (isTime) onSelect(value, x)
    else onSelect(x === '(empty)' ? null : x)
  }
  const clickable = onSelect ? 'cursor-pointer hover:bg-muted/50' : ''
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-card text-[11px] text-muted-foreground">
          <tr className="border-b border-border">
            <th className="whitespace-nowrap py-1.5 pr-3 text-left font-medium">{firstColumnLabel(shaped.axis, bucket, spec.dimension?.field?.col)}</th>
            {showTotal && <th className="whitespace-nowrap py-1.5 pl-3 text-right font-medium">Total</th>}
            {keys.map((key) => (
              <th key={key} className="max-w-[10rem] truncate whitespace-nowrap py-1.5 pl-3 text-right font-medium" title={key}>
                {key === 'value' ? 'Value' : shortLabel(key, 18)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shaped.points.map((p) => (
            <tr key={p.x} className={cn('border-b border-border/60', clickable)} onClick={() => open(undefined, p.x)}>
              <td className="py-1.5 pr-3 text-foreground" title={p.x}>
                {isTime ? formatBucket(p.x, bucket) : shortLabel(p.x, 40)}
              </td>
              {showTotal && (
                <td className="py-1.5 pl-3 text-right font-medium tabular-nums text-foreground">{formatValue(sum(keys.map((k) => p[k])), spec)}</td>
              )}
              {keys.map((key) => {
                const v = num(p[key])
                // on a chart over time a cell is one value on one day: it opens exactly those calls
                const cell = isTime && keys.length > 1 && v ? (e: React.MouseEvent) => { e.stopPropagation(); open(key === '(empty)' ? null : key, p.x) } : undefined
                return (
                  <td
                    key={key}
                    onClick={cell}
                    className={cn('py-1.5 pl-3 text-right tabular-nums text-foreground', cell && 'cursor-pointer underline-offset-2 hover:bg-muted hover:underline')}
                  >
                    {formatValue(v, spec)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        {showTotal && (
          <tfoot className="sticky bottom-0 bg-card text-foreground">
            <tr className="border-t border-border font-medium">
              <td className="py-1.5 pr-3">Total</td>
              <td className="py-1.5 pl-3 text-right tabular-nums">{formatValue(sum(shaped.points.flatMap((p) => keys.map((k) => p[k]))), spec)}</td>
              {keys.map((key) => (
                <td key={key} className="py-1.5 pl-3 text-right tabular-nums">{formatValue(sum(shaped.points.map((p) => p[key])), spec)}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function Notice({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
      {children}
    </div>
  )
}
