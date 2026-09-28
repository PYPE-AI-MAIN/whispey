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
const SERIES_COLORS = [
  'var(--analytics-series-1)', 'var(--analytics-series-2)', 'var(--analytics-series-3)', 'var(--analytics-series-4)',
  'var(--analytics-series-5)', 'var(--analytics-series-6)', 'var(--analytics-series-7)', 'var(--analytics-series-8)',
]

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
    border: '1px solid rgb(209 213 219)',
    fontSize: 12,
    background: 'rgb(255 255 255)',
    color: 'rgb(17 24 39)',
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
  onSelect?: (value: string | null) => void
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
              <Cell key={p.x} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
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
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={shaped.points} margin={{ top: 8, right: 12, left: -12, bottom: angleTicks ? 28 : 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
        {/* interval={0}: "preserveStartEnd" only promises the first/last tick — for the
            rest it guesses which labels would overlap, and with mixed-length category
            labels it sometimes guesses wrong and drops a label while still drawing its
            bar. Forcing every tick to render, plus angling them below, fixes both the
            missing label and the overlap. */}
        <XAxis
          dataKey="x"
          tickFormatter={tickFor}
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          interval={0}
          {...(angleTicks ? { angle: -35, textAnchor: 'end' as const, height: 56 } : {})}
        />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={44} unit={suffix || undefined} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(x: unknown) => (shaped.axis === 'time' ? formatBucket(String(x), bucket) : String(x))}
          formatter={(v: unknown) => formatValue(Number(v), spec)}
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
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
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
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              radius={shaped.seriesKeys.length > 1 ? 0 : [4, 4, 0, 0]}
              // one bucket would otherwise render as a wall the width of the card
              maxBarSize={64}
              cursor={onSelect ? 'pointer' : undefined}
              onClick={(bar: unknown) => onSelect?.(readX(bar))}
            />
          )
        )}
      </Chart>
    </ResponsiveContainer>
  )
}

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
          'truncate font-semibold tabular-nums text-gray-900 dark:text-gray-50',
          // `short` (h <= 2) alone isn't enough of a signal: on a NARROW card
          // too, the header's grain-label + definition line wraps onto a
          // second line (deliberately — it's allowed to wrap rather than
          // truncate into something unreadable), which eats into the same
          // fixed-height card's budget and left this box shorter than the
          // number's own line-height, clipped top and bottom by the
          // `overflow-hidden` above. One size further down guarantees room
          // even when that second header line shows up.
          sizeClass(short, compact),
          value === null && 'text-gray-400 dark:text-gray-500'
        )}
      >
        {value === null ? '—' : formatValue(value, spec)}
      </div>
    </div>
  )
}

function Table({
  shaped, spec, bucket, onSelect,
}: Readonly<{
  shaped: ReturnType<typeof shape>
  spec: SpecInput
  bucket?: string
  onSelect?: (value: string | null) => void
}>) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <tbody>
          {shaped.points.map((p) => (
            <tr
              key={p.x}
              className={cn(
                'border-b border-gray-100 last:border-0 dark:border-gray-800',
                onSelect && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60'
              )}
              onClick={() => onSelect?.(p.x === '(empty)' ? null : p.x)}
            >
              <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300" title={p.x}>
                {shaped.axis === 'time' ? formatBucket(p.x, bucket) : shortLabel(p.x, 40)}
              </td>
              {shaped.seriesKeys.map((key) => (
                <td key={key} className="py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">
                  {formatValue(typeof p[key] === 'number' ? p[key] : null, spec)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Notice({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-gray-500 dark:text-gray-400">
      {children}
    </div>
  )
}
