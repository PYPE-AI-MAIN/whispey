'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useTheme } from 'next-themes'
import { getPublicDashboardUrl } from '@/config/metabaseDashboards'
import { BarChart3, ExternalLink, Calendar, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

function getDefaultDates() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(from), to: fmt(to) }
}

export default function AnalyticsPage() {
  const params = useParams()
  const projectId = params.projectid as string
  const { resolvedTheme } = useTheme()


  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [iframeKey, setIframeKey] = useState(0)

  const baseUrl = getPublicDashboardUrl(projectId)

  const iframeSrc = baseUrl
    ? `${baseUrl}?date_from=${dateFrom}&date_to=${dateTo}&project_id=${projectId}`
    : null

  const handleRefresh = () => setIframeKey(k => k + 1)

  if (!baseUrl) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto">
            <BarChart3 className="w-7 h-7 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              No Analytics Dashboard
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              Analytics haven't been configured for this organisation yet.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex-none border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 flex-1">
          <BarChart3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Org Overview
          </span>
        </div>

        {/* Date range pickers */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="text-xs border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <span className="text-gray-400">→</span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="text-xs border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <a
            href={iframeSrc ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Metabase
          </a>
        </div>
      </div>

      {/* Iframe */}
      <div className={`flex-1 overflow-hidden ${resolvedTheme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
        <iframe
            key={`${iframeKey}-${resolvedTheme}`}
            src={iframeSrc ?? ''}
            className={`w-full h-full border-0 ${resolvedTheme === 'dark' ? 'invert hue-rotate-180 brightness-95' : ''}`}
            title="Org Analytics Dashboard"
        />
        </div>
    </div>
  )
}