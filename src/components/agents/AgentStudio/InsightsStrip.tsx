'use client'

import { Info, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Insight {
  title: string
  definition: string
  help: string
  value: string
  suffix?: string
  delta?: { text: string; good: boolean; up: boolean }
}

// Placeholder until per-agent scoring is wired up — rendered with a "Sample
// data" chip so nobody mistakes it for real numbers.
const SAMPLE_INSIGHTS: Insight[] = [
  {
    title: 'Frustration score',
    definition: 'Avg. caller sentiment · 1 calm – 5 frustrated',
    help: 'Scored per call from the transcript, then averaged. Lower is better.',
    value: '1.4',
    suffix: '/ 5',
    delta: { text: '0.3 vs prev. 7d', good: true, up: false },
  },
  {
    title: 'Task completion',
    definition: 'Calls that reached the goal step',
    help: 'Share of answered calls where the agent completed its objective (e.g. a booking).',
    value: '82',
    suffix: '%',
    delta: { text: '4% vs prev. 7d', good: true, up: true },
  },
  {
    title: 'Avg. call duration',
    definition: 'Mean length of answered calls',
    help: 'Average duration across answered calls in the period.',
    value: '2m 14s',
  },
  {
    title: 'Calls',
    definition: 'Test and live calls',
    help: 'Every call this agent handled in the period, including test calls from this page.',
    value: '128',
    delta: { text: '12 vs prev. 7d', good: true, up: true },
  },
]

function InsightCard({ insight }: Readonly<{ insight: Insight }>) {
  const DeltaIcon = insight.delta?.up ? TrendingUp : TrendingDown
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white px-4 pb-3 pt-3 shadow-sm transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div className="flex items-center gap-1.5">
        <h3 className="truncate text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {insight.title}
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`How ${insight.title} is calculated`}
                className="shrink-0 text-gray-300 transition hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-[220px] text-xs">
              <p className="font-medium">{insight.definition}</p>
              <p className="mt-1 text-gray-300 dark:text-gray-500">{insight.help}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{insight.value}</span>
        {insight.suffix && (
          <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{insight.suffix}</span>
        )}
      </div>
      {insight.delta && (
        <p
          className={cn(
            'mt-0.5 flex items-center gap-1 text-[11px] font-medium',
            insight.delta.good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          )}
        >
          <DeltaIcon className="h-3 w-3" />
          {insight.delta.text}
        </p>
      )}
    </div>
  )
}

export default function InsightsStrip() {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-0.5">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">Last 7 days</span>
        <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] uppercase tracking-wide text-gray-400 dark:bg-gray-800/80 dark:text-gray-500">
          Sample data
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {SAMPLE_INSIGHTS.map((insight) => (
          <InsightCard key={insight.title} insight={insight} />
        ))}
      </div>
    </div>
  )
}
