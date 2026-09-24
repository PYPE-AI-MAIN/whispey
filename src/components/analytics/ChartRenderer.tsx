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
 * The dataviz skill's validated 8-slot categorical order (references/palette.md)
 * — fixed order, never cycled, worst adjacent CVD ΔE 9.1 light / 8.4 dark. Swap
 * one slot in and the safety guarantee is gone; add a 9th series by folding into
 * "Other", not by generating a new hue.
 */
const SERIES_COLORS = [
  'var(--analytics-series-1)', 'var(--analytics-series-2)', 'var(--analytics-series-3)', 'var(--analytics-series-4)',
  'var(--analytics-series-5)', 'var(--analytics-series-6)', 'var(--analytics-series-7)', 'var(--analytics-series-8)',
]

/** Above this a pie stops meaning anything; the card offers a bar instead. */
export const PIE_MAX_SLICES = 8

const axisStyle = { fontSize: 11, fill: 'currentColor' } as const

/**
 * recharts hands its click callbacks a wide union; read the one field we put there.
 *
 * For a `<Bar onClick>`, the argument is the rectangle's own render props —
 * which already has an `x` field of its own: the bar's pixel position on
 * screen, a number. Our actual data point (`{ x: "general_callback", ... }`)
 * is nested under `datum.payload`, not spread onto the top level. Reading
 * `datum.x` directly saw the pixel number, failed the string check, and
 * returned null — every bar drilled into "no value" and matched nothing,
 * while the tooltip (which reads the payload correctly) kept showing the
 * right name. Check `.payload.x` first; fall back to `.x` for shapes (Pie)
 * that do put it there directly.
 */
const readX = (datum: unknown): string | null => {
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

  if (kind === 'kpi') return <Kpi rows={rows} spec={spec} short={short} />
  // a table with nothing to break down is just the number
  if (kind === 'table' && shape(rows, spec).axis === 'none') return <Kpi rows={rows} spec={spec} short={short} />

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
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={shaped.points} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
        {/* interval={0}: "preserveStartEnd" only guarantees the first/last tick — for
            the rest, recharts guesses which labels would overlap using an approximate
            width estimate, and with category labels this varied in length it sometimes
            guesses wrong and drops a label's text while still drawing its bar. Forcing
            every tick to render is cheap at this category count (well under a couple
            dozen); if a chart ever needs many more categories, revisit with rotation
            instead of reintroducing the heuristic. */}
        <XAxis dataKey="x" tickFormatter={tickFor} tick={axisStyle} tickLine={false} axisLine={false} interval={0} />
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

function Kpi({ rows, spec, short }: Readonly<{ rows: ResultRow[]; spec: SpecInput; short?: boolean }>) {
  const value = displayNumber(rows[0], spec)
  return (
    <div className="flex h-full flex-col justify-center overflow-hidden">
      <div
        className={cn(
          'truncate font-semibold tabular-nums text-gray-900 dark:text-gray-50',
          short ? 'text-2xl' : 'text-3xl',
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
