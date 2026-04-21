'use client'
import React from 'react'
import { Plus, Settings2, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetricGroup } from '@/types/metricGroups'
import { useMobile } from '@/hooks/use-mobile'

interface MetricGroupTabsProps {
  groups: MetricGroup[]
  activeGroupId: string | 'all'
  onGroupChange: (groupId: string | 'all') => void
  onManageGroups: () => void
  customTotalsCount: number
  /** When false, hide create/manage group controls (viewers). Default true. */
  canManageGroups?: boolean
  /** Opens the custom chart builder dialog (overview). */
  onAddChart?: () => void
  /** When true, show Add chart at the end of the row (desktop overview). */
  showAddChart?: boolean
}

export function MetricGroupTabs({
  groups,
  activeGroupId,
  onGroupChange,
  onManageGroups,
  customTotalsCount,
  canManageGroups = true,
  onAddChart,
  showAddChart = false,
}: MetricGroupTabsProps) {
  const { isMobile } = useMobile(768)
  const showAddChartButton = Boolean(!isMobile && showAddChart && onAddChart)
  const showRightCluster = canManageGroups || showAddChartButton

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      <div className={`flex items-center gap-3 ${isMobile ? 'px-4 py-3' : 'px-8 py-4'}`}>
        {/* Scrollable tabs container */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
          {/* All Tab */}
          <button
            onClick={() => onGroupChange('all')}
            className={`
              ${isMobile ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm'}
              font-medium rounded-lg transition-all whitespace-nowrap shrink-0
              ${activeGroupId === 'all'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
              }
            `}
          >
            Overview
            <span className={`ml-1.5 ${isMobile ? 'text-xs' : 'text-xs'} opacity-60`}>
              ({7 + customTotalsCount})
            </span>
          </button>

          {/* Custom Group Tabs */}
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => onGroupChange(group.id)}
              className={`
                ${isMobile ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm'}
                font-medium rounded-lg transition-all whitespace-nowrap shrink-0
                ${activeGroupId === group.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
                }
              `}
            >
              {group.name}
              <span className={`ml-1.5 ${isMobile ? 'text-xs' : 'text-xs'} opacity-60`}>
                ({group.metric_ids.length + group.chart_ids.length})
              </span>
            </button>
          ))}
        </div>

        {showRightCluster && (
          <div className="flex shrink-0 items-center gap-2 border-l border-gray-200 pl-3 dark:border-gray-700">
            {canManageGroups && (
              <button
                type="button"
                onClick={onManageGroups}
                title="Metric groups"
                aria-label="Open metric groups"
                className={`
                  ${isMobile ? 'px-3 py-1.5' : 'px-3 py-2'}
                  text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300
                  hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-all
                  border border-dashed border-gray-300 dark:border-gray-600 whitespace-nowrap
                `}
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            {canManageGroups && !isMobile && groups.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onManageGroups} className="shrink-0">
                <Settings2 className="mr-2 h-4 w-4" />
                Manage
              </Button>
            )}
            {showAddChartButton && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddChart}
                className="shrink-0 gap-1.5 border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/50"
              >
                <BarChart3 className="h-4 w-4" />
                Add chart
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}