'use client'
import React from 'react'
import { Plus, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetricGroup } from '@/types/metricGroups'
import { useMobile } from '@/hooks/use-mobile'

interface MetricGroupTabsProps {
  groups: MetricGroup[]
  activeGroupId: string | 'all'
  onGroupChange: (groupId: string | 'all') => void
  onManageGroups: () => void
  customTotalsCount: number
}

export function MetricGroupTabs({
  groups,
  activeGroupId,
  onGroupChange,
  onManageGroups,
  customTotalsCount
}: MetricGroupTabsProps) {
  const { isMobile } = useMobile(768)

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      <div className={`flex items-center justify-between ${isMobile ? 'px-4 py-3' : 'px-8 py-4'}`}>
        {/* Scrollable tabs container */}
        <div className="flex items-center gap-2 overflow-x-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500">
          {/* All Tab */}
          <button
            onClick={() => onGroupChange('all')}
            className={`
              ${isMobile ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm'}
              font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0
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
                font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0
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

          {/* New Group Button */}
          <button
            onClick={onManageGroups}
            className={`
              ${isMobile ? 'px-3 py-1.5' : 'px-4 py-2'}
              text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300
              hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-all
              border border-dashed border-gray-300 dark:border-gray-600 whitespace-nowrap flex-shrink-0
            `}
          >
            <Plus className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'}`} />
          </button>
        </div>

        {/* Manage Button */}
        {!isMobile && groups.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onManageGroups}
            className="ml-4 flex-shrink-0"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Manage
          </Button>
        )}
      </div>
    </div>
  )
}