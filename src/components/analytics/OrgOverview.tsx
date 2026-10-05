/**
 * Org Overview tab — Confluence "Analytics Phase 3 and 4 — Build Spec" §3.5.1.
 * Fixed KPI tiles, summed/averaged across every agent in the project, plus an
 * Agent Breakdown table. Clicking a row goes to that agent's own existing
 * page — unchanged, per §3.5.1.
 */
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DateRange as DayPickerRange } from 'react-day-picker'
import { CalendarDays, Clock3, Loader2, PhoneCall, PhoneIncoming, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useOrgOverview, type OrgAgentRow, type OverviewRange } from '@/hooks/useOrgOverview'
import { formatValue } from './chartData'
import { OverviewSkeleton } from './OverviewSkeleton'
import type { SpecInput } from '@/server/analytics/spec'

const DAY_OPTIONS = [7, 30, 90]

const KPI_SPECS: Record<'calls' | 'pickup' | 'latency' | 'billing', SpecInput> = {
  calls: { spec_version: 1, agg: { fn: 'count' }, range: { days: 30 }, display: { round: 0 } },
  pickup: { spec_version: 1, agg: { fn: 'count' }, range: { days: 30 }, display: { round: 1, unit: '%' } },
  latency: { spec_version: 1, agg: { fn: 'avg', field: { col: 'avg_latency' } }, range: { days: 30 }, display: { round: 2, unit: 's' } },
  billing: { spec_version: 1, agg: { fn: 'sum_ceil_minutes', field: { col: 'billing_duration_seconds' } }, range: { days: 30 }, display: { round: 0, unit: 'm' } },
}

const formatDateISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const formatShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const parseLocalDate = (s: string) => {
  const [y, mo, d] = s.split('-').map(Number)
  return new Date(y, mo - 1, d)
}

const KPI_ICONS = {
  calls: PhoneCall,
  pickup: PhoneIncoming,
  latency: Clock3,
  billing: Timer,
} as const

function Kpi({
  label, value, spec, icon: Icon,
}: Readonly<{ label: string; value: number | null; spec: SpecInput; icon: (typeof KPI_ICONS)[keyof typeof KPI_ICONS] }>) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {value === null ? '—' : formatValue(value, spec)}
      </div>
    </div>
  )
}

function StatusBadge({ isActive }: Readonly<{ isActive: boolean }>) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {isActive ? 'Live' : 'Inactive'}
    </span>
  )
}

function AgentRow({ agent, projectId }: Readonly<{ agent: OrgAgentRow; projectId: string }>) {
  const router = useRouter()
  return (
    <tr
      className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800/70 dark:hover:bg-gray-800/40"
      onClick={() => router.push(`/${projectId}/agents/${agent.id}`)}
    >
      <td className="py-4 pl-6 pr-4 font-medium text-gray-900 dark:text-gray-100">{agent.name}</td>
      <td className="py-4 pr-4 tabular-nums text-gray-700 dark:text-gray-300">{agent.calls?.toLocaleString() ?? '—'}</td>
      <td className="py-4 pr-4 tabular-nums text-gray-700 dark:text-gray-300">
        {agent.pickupPct === null ? '—' : `${agent.pickupPct.toFixed(0)}%`}
      </td>
      <td className="py-4 pr-4 tabular-nums text-gray-700 dark:text-gray-300">
        {agent.latency === null ? '—' : `${agent.latency.toFixed(1)}s`}
      </td>
      <td className="py-4 pr-6 text-gray-500 dark:text-gray-400">
        <StatusBadge isActive={agent.is_active} />
      </td>
    </tr>
  )
}

/**
 * Quick-pick day pills plus a custom-range calendar popover — same pattern as
 * the per-agent Period control in Dashboard.tsx. Exported: the Explore tab
 * reuses this exact control rather than a second copy of the same UI.
 */
export function RangePicker({ range, onChange }: Readonly<{ range: OverviewRange; onChange: (r: OverviewRange) => void }>) {
  const isCustom = 'from' in range
  const [draft, setDraft] = useState<DayPickerRange | undefined>(
    isCustom ? { from: parseLocalDate(range.from), to: parseLocalDate(range.to) } : undefined
  )

  const handleSelect = (picked: DayPickerRange | undefined) => {
    setDraft(picked)
    if (picked?.from && picked?.to) onChange({ from: formatDateISO(picked.from), to: formatDateISO(picked.to) })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-800">
        {DAY_OPTIONS.map((days) => (
          <button
            key={days}
            onClick={() => onChange({ days })}
            // h-8 matches the Button component's own "sm" size (button.tsx) so
            // this pill group lines up with the Custom range button beside it
            // instead of sitting a few px shorter
            className={`flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
              !isCustom && 'days' in range && range.days === days
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            {days} days
          </button>
        ))}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={isCustom ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300' : ''}
          >
            <CalendarDays className="mr-2 h-3.5 w-3.5 shrink-0" />
            {isCustom ? `${formatShort(parseLocalDate(range.from))} – ${formatShort(parseLocalDate(range.to))}` : 'Custom range'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-xl border-gray-200 p-0 shadow-xl dark:border-gray-700" align="end">
          <Calendar mode="range" defaultMonth={draft?.from} selected={draft} onSelect={handleSelect} numberOfMonths={2} className="rounded-xl" />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function OrgOverview({
  projectId,
  isActive,
  selectedAgentIds,
}: Readonly<{ projectId: string; isActive: boolean; selectedAgentIds: string[] | null }>) {
  const [range, setRange] = useState<OverviewRange>({ days: 30 })
  const { data, isLoading, error } = useOrgOverview(projectId, range, selectedAgentIds, isActive)
  // the full skeleton only for the first paint — once real numbers are on
  // screen, switching the date range shows the small spinner instead, so
  // changing "30 days" to "90 days" doesn't blank the whole page every time
  const hasData = data.totalCalls !== null || data.agents.length > 0

  if (isLoading && !hasData) {
    return (
      <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <OverviewSkeleton />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8 md:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            {/* text-2xl/tracking-tight matches this app's real page-title convention
                (e.g. api-keys/page.tsx's <h1>) — text-xl read undersized next to it */}
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Overview</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Summed across every agent in this project.</p>
          </div>
          <div className="flex items-center gap-3">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            <RangePicker range={range} onChange={setRange} />
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30">
            {error.message}
          </p>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Total Calls" value={data.totalCalls} spec={KPI_SPECS.calls} icon={KPI_ICONS.calls} />
          <Kpi label="Pickup %" value={data.pickupPct} spec={KPI_SPECS.pickup} icon={KPI_ICONS.pickup} />
          <Kpi label="Avg Latency" value={data.avgLatency} spec={KPI_SPECS.latency} icon={KPI_ICONS.latency} />
          <Kpi label="Billing Minutes" value={data.billingMinutes} spec={KPI_SPECS.billing} icon={KPI_ICONS.billing} />
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Agent breakdown</h2>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {/* Rounding/clipping lives on this outer div (overflow-hidden); the
                actual scrolling (both directions) happens on the inner div
                instead of here — combining overflow-auto with rounded-xl on
                the same element let the sticky header's background fail to
                paint to the full rendered width in some browsers (a visible
                notch cut into the top-right corner). Splitting them fixes it,
                same as the Team Members table's own version of this bug.
                min-w on the table is what actually triggers horizontal
                scrolling on a narrow screen, instead of every column just
                shrinking until the text wraps. max-h caps the list at ~10
                rows instead of pushing the whole page taller for a project
                with dozens of agents; the header is sticky so it stays put
                while that scrolls. */}
            <div className="overflow-hidden rounded-xl">
              <div className="max-h-[32rem] overflow-auto scrollbar-thin">
                <table className="w-full min-w-[640px] text-sm">
                  {/* Background on each <th>, not the <thead>/<tr> — see the comment above. */}
                  <thead className="sticky top-0 z-10 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 pl-6 pr-4 font-semibold border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">Agent</th>
                      <th className="py-3 pr-4 font-semibold border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">Calls</th>
                      <th className="py-3 pr-4 font-semibold border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">Pickup %</th>
                      <th className="py-3 pr-4 font-semibold border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">Latency</th>
                      <th className="py-3 pr-6 font-semibold border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">Status</th>
                    </tr>
                  </thead>
                <tbody>
                  {data.agents.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-500 dark:text-gray-400">
                        No agents in this project yet.
                      </td>
                    </tr>
                  )}
                  {data.agents.map((a) => (
                    <AgentRow key={a.id} agent={a} projectId={projectId} />
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
