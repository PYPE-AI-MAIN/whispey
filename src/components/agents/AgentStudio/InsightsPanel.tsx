'use client'

import { BarChart3 } from 'lucide-react'

// Placeholder until real per-agent scoring lands — clearly labeled as example
// data, not wired to a metrics pipeline yet.
const EXAMPLE_INSIGHTS = [
  { label: 'Frustration score', value: '1.4 / 5' },
  { label: 'Task completion rate', value: '82%' },
  { label: 'Avg. call duration', value: '2m 14s' },
  { label: 'Calls today', value: '—' },
]

export default function InsightsPanel() {
  return (
    <div className="h-full px-8 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-gray-900 dark:text-gray-100">
          <BarChart3 className="h-3.5 w-3.5 text-gray-400" />
          Insights
        </h2>
        <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 dark:border-gray-800">
          example
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {EXAMPLE_INSIGHTS.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-gray-200 px-3.5 py-3 dark:border-gray-800"
          >
            <p className="mb-1 text-[11px] text-gray-500">{item.label}</p>
            <p className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
