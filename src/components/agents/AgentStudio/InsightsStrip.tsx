'use client'

import { useMemo } from 'react'
import { Info, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useChartData, type AnalyticsScope } from '@/hooks/useAnalyticsDashboard'
import type { Widget, WidgetResult } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'

// The analytics engine rejects ranges over 400 days (MAX_RANGE_DAYS in
// server/analytics/context.ts), so this is the widest "overall" window it can
// answer. (730 passes the spec schema but is refused at query time.)
const ALL_TIME_RANGE = { days: 400 }

interface InsightDef {
  id: string
  title: string
  definition: string
  help: string
  /** Analytics spec that produces the number. Omit while a metric is still to be defined. */
  spec?: SpecInput
  format: (value: number) => string
}

// Edit this list to change what the strip shows — each entry is one card.
// A card without a `spec` renders as "not defined yet" instead of a number.
const INSIGHTS: InsightDef[] = [
  {
    id: 'calls',
    title: 'Calls',
    definition: 'All calls, overall',
    help: 'Every call this agent has handled over the last 400 days, including test calls from this page.',
    spec: { spec_version: 1, agg: { fn: 'count' }, range: ALL_TIME_RANGE },
    format: String,
  },
  {
    id: 'completion_rate',
    title: 'Completion rate',
    definition: 'Not defined yet',
    help: 'Will show the share of calls that reach their goal, once the definition is set.',
    format: (v) => `${Math.round(v)}%`,
  },
]

function makeWidget(id: string, spec: SpecInput): Widget {
  return {
    id,
    dashboard_id: '',
    title: id,
    kind: 'kpi',
    spec,
    layout: { x: 0, y: 0, w: 3, h: 2 },
    position: 0,
    live: false,
    is_seeded: false,
  }
}

function firstValue(result: WidgetResult | undefined): number | null {
  const v = result?.data?.[0]?.value
  return v === null || v === undefined ? null : Number(v)
}

function InsightValue({
  def, value, loading, failure,
}: Readonly<{ def: InsightDef; value: number | null; loading: boolean; failure?: string }>) {
  if (value !== null) {
    return (
      <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {def.format(value)}
      </span>
    )
  }
  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-gray-300 dark:text-gray-600" />
  if (failure) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">Unavailable — refresh to retry</span>
  }
  return <span className="text-2xl font-semibold text-gray-300 dark:text-gray-700">—</span>
}

/** Why a card has no number: the whole query failed, or just this widget did. */
function failureFor(def: InsightDef, result: WidgetResult | undefined, error: Error | null): string | undefined {
  if (!def.spec) return undefined
  if (error) return error.message
  if (result && result.status !== 'ok') return result.error ?? result.status
  return undefined
}

function InsightCard({
  def, value, loading, failure,
}: Readonly<{ def: InsightDef; value: number | null; loading: boolean; failure?: string }>) {
  const defined = !!def.spec
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white px-4 pb-3 pt-3 shadow-sm transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div className="flex items-center gap-1.5">
        <h3 className="truncate text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {def.title}
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`How ${def.title} is calculated`}
                className="shrink-0 cursor-pointer text-gray-300 transition hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-[220px] text-xs">
              <p className="font-medium">{def.definition}</p>
              <p className="mt-1 text-gray-300 dark:text-gray-500">{def.help}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <InsightValue def={def} value={value} loading={defined && loading} failure={failure} />
      </div>
    </div>
  )
}

export default function InsightsStrip({ agentId }: Readonly<{ agentId: string }>) {
  const widgets = useMemo(
    () => INSIGHTS.filter((d) => d.spec).map((d) => makeWidget(d.id, d.spec as SpecInput)),
    []
  )
  // The analytics hooks take a scope (one agent's dashboard, or a project's),
  // not a bare id. Memoised so the hook doesn't see a new object every render.
  const scope = useMemo<AnalyticsScope | undefined>(
    () => (agentId ? { kind: 'agent', id: agentId } : undefined),
    [agentId]
  )
  const { byWidget, isFetching, error } = useChartData(
    scope,
    widgets,
    undefined, // each widget carries its own range
    [],
    { timeOfDay: null, days: [] },
    !!agentId
  )

  if (error) console.warn('[Studio insights] analytics query failed:', error.message)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-0.5">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">Overall</span>
        {isFetching && <Loader2 className="h-3 w-3 animate-spin text-gray-300 dark:text-gray-600" />}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {INSIGHTS.map((def) => {
          const result = def.spec ? byWidget.get(def.id) : undefined
          const failure = failureFor(def, result, error)
          if (failure) console.warn(`[Studio insights] ${def.id}:`, failure)
          return (
            <InsightCard
              key={def.id}
              def={def}
              value={def.spec ? firstValue(result) : null}
              loading={isFetching}
              failure={failure}
            />
          )
        })}
      </div>
    </div>
  )
}
