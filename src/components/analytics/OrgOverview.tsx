/**
 * Org Overview tab — Confluence "Analytics Phase 3 and 4 — Build Spec" §3.5.1.
 * Fixed KPI tiles, summed/averaged across every agent in the project, plus an
 * Agent Breakdown table. Clicking a row goes to that agent's own existing
 * page — unchanged, per §3.5.1.
 */
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useOrgOverview, type OrgAgentRow } from '@/hooks/useOrgOverview'
import { formatValue } from './chartData'
import type { SpecInput } from '@/server/analytics/spec'

const RANGE_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

const KPI_SPECS: Record<'calls' | 'success' | 'latency' | 'cost', SpecInput> = {
  calls: { spec_version: 1, agg: { fn: 'count' }, range: { days: 30 }, display: { round: 0 } },
  success: { spec_version: 1, agg: { fn: 'count' }, range: { days: 30 }, display: { round: 1, unit: '%' } },
  latency: { spec_version: 1, agg: { fn: 'avg', field: { col: 'avg_latency' } }, range: { days: 30 }, display: { round: 2, unit: 's' } },
  cost: { spec_version: 1, agg: { fn: 'sum', field: { col: 'total_cost' } }, range: { days: 30 }, display: { round: 2, unit: '₹' } },
}

function Kpi({ label, value, spec }: Readonly<{ label: string; value: number | null; spec: SpecInput }>) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {value === null ? '—' : formatValue(value, spec)}
      </div>
    </div>
  )
}

function AgentRow({ agent, projectId }: Readonly<{ agent: OrgAgentRow; projectId: string }>) {
  const router = useRouter()
  return (
    <tr
      className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800/70 dark:hover:bg-gray-800/40"
      onClick={() => router.push(`/${projectId}/agents/${agent.id}`)}
    >
      <td className="py-3.5 pr-4 font-medium text-gray-900 dark:text-gray-100">{agent.name}</td>
      <td className="py-3.5 pr-4 tabular-nums text-gray-700 dark:text-gray-300">{agent.calls?.toLocaleString() ?? '—'}</td>
      <td className="py-3.5 pr-4 tabular-nums text-gray-700 dark:text-gray-300">
        {agent.successPct === null ? '—' : `${agent.successPct.toFixed(0)}%`}
      </td>
      <td className="py-3.5 pr-4 tabular-nums text-gray-700 dark:text-gray-300">
        {agent.latency === null ? '—' : `${agent.latency.toFixed(1)}s`}
      </td>
      <td className="py-3.5 text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${agent.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          {agent.is_active ? 'live' : 'inactive'}
        </span>
      </td>
    </tr>
  )
}

export function OrgOverview({ projectId, isActive }: Readonly<{ projectId: string; isActive: boolean }>) {
  const [days, setDays] = useState(30)
  const { data, isLoading, error } = useOrgOverview(projectId, days, isActive)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-6 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Overview</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Summed across every agent in this project.</p>
          </div>
          <div className="flex items-center gap-3">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            <div className="flex gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-800">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setDays(opt.days)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    days === opt.days
                      ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30">
            {error.message}
          </p>
        )}

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Total Calls" value={data.totalCalls} spec={KPI_SPECS.calls} />
          <Kpi label="Success %" value={data.successPct} spec={KPI_SPECS.success} />
          <Kpi label="Avg Latency" value={data.avgLatency} spec={KPI_SPECS.latency} />
          <Kpi label="Cost" value={data.totalCost} spec={KPI_SPECS.cost} />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">Agent breakdown</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-400">
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="px-5 py-3 font-medium">Agent</th>
                  <th className="px-5 py-3 font-medium">Calls</th>
                  <th className="px-5 py-3 font-medium">Success %</th>
                  <th className="px-5 py-3 font-medium">Latency</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="[&_td]:px-5">
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
  )
}
