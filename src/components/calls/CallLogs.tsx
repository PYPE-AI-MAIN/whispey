"use client"

import React, { useCallback, useMemo, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, Inbox } from "lucide-react"
import CallFilter, { FilterOperation } from "../CallFilter"
import ColumnSelector from "../shared/ColumnSelector"
import { cn } from "@/lib/utils"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'

// Import optimized modules
import { downloadCSV } from '@/utils/callLogsUtils'
import { useCallLogsData } from '@/hooks/useCallLogsData'
import { useCallLogsColumns, BASIC_COLUMNS } from '@/hooks/useCallLogsColumns'
import { useCallLogsStore } from '@/stores/callLogsStore'
import { createTableColumns } from './tableColumns'
import {
  FilterHeaderSkeleton,
  TableSkeleton,
  ReanalyzeDialogWrapper
} from './sub-components'
import BackfillDispositionDialog from '@/components/disposition/BackfillDispositionDialog'
import { useVirtualization } from '@/hooks/useVirtualization'

interface CallLogsProps {
  project: any
  agent: any
  onBack: () => void
  isLoading?: boolean
  dateRange?: { from: string; to: string }
}

const CallLogs: React.FC<CallLogsProps> = ({ 
  project, 
  agent, 
  onBack, 
  isLoading: parentLoading,
  dateRange
}) => {
  const router = useRouter()
  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Use custom hooks for data management
  const {
    calls,
    role,
    roleLoading,
    isLoading,
    isRefetching,
    hasNextPage,
    error,
    activeFilters,
    setActiveFilters,
    fetchNextPage,
    refetch
  } = useCallLogsData(agent, userEmail, project?.id, dateRange)

  // Scroll restoration hook (must be after calls is defined)
  useEffect(() => {
    const scrollKey = `call-logs-scroll-${agent?.id}`
    const container = scrollContainerRef.current
    
    if (!container || !calls.length) return

    // Restore scroll position after data loads
    const savedPosition = sessionStorage.getItem(scrollKey)
    if (savedPosition) {
      // Use multiple requestAnimationFrame to ensure DOM is fully rendered and virtualization is ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (container) {
              const position = parseInt(savedPosition, 10)
              container.scrollTop = position
              // Trigger a scroll event to ensure virtualization recalculates
              container.dispatchEvent(new Event('scroll', { bubbles: false }))
            }
          })
        })
      })
    }

    // Save scroll position on scroll (debounced to 100ms)
    let scrollTimeout: NodeJS.Timeout
    const handleScroll = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        if (container) {
          sessionStorage.setItem(scrollKey, container.scrollTop.toString())
        }
      }, 100)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [agent?.id, calls.length]) // Re-run when agent changes or data loads

  // Use custom hook for columns management
  const {
    visibleColumns,
    setVisibleColumns,
    dynamicColumns,
    dynamicColumnsKey,
    filteredBasicColumns
  } = useCallLogsColumns(agent, calls, role)

  // Memoize table columns
  const columns = useMemo(
    () => createTableColumns(visibleColumns),
    [visibleColumns]
  )

  // React Table instance
  const table = useReactTable({
    data: calls,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  // Virtualization configuration
  const ROW_HEIGHT = 80 // h-20 = 80px
  const HEADER_HEIGHT = 48 // h-12 = 48px
  const rows = table.getRowModel().rows
  const ENABLE_VIRTUALIZATION_THRESHOLD = 30 // Only virtualize if we have more than 30 rows
  
  // Use virtualization hook (only when we have enough rows)
  const shouldVirtualize = rows.length > ENABLE_VIRTUALIZATION_THRESHOLD
  const {
    startIndex,
    endIndex,
    visibleItems,
    totalHeight,
    offsetY,
  } = useVirtualization({
    itemHeight: ROW_HEIGHT,
    containerRef: scrollContainerRef,
    totalItems: rows.length,
    overscan: 5,
    headerHeight: HEADER_HEIGHT,
  })

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isLoading) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasNextPage, isLoading, fetchNextPage])

  // Get distinct config from store
  const { distinctConfig, setDistinctConfig } = useCallLogsStore()

  // Event handlers - wrapped in useCallback
  const handleFiltersChange = useCallback((operations: FilterOperation[]) => {
    setActiveFilters(operations)
  }, [setActiveFilters])

  const handleClearFilters = useCallback(() => {
    setActiveFilters([])
  }, [setActiveFilters])

  const handleDistinctConfigChange = useCallback((config: typeof distinctConfig) => {
    setDistinctConfig(config)
  }, [setDistinctConfig])

  const handleRefresh = useCallback(async () => {
    if (isRefetching) return
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    await refetch()
  }, [refetch, isRefetching])

  const handleDownloadCSV = useCallback(async () => {
    if (!agent?.id) return
    
    try {
      await downloadCSV(agent.id, activeFilters, {
        basic: visibleColumns.basic,
        metadata: visibleColumns.metadata,
        transcription_metrics: visibleColumns.transcription_metrics
      })
    } catch (error) {
      alert((error as Error).message)
    }
  }, [agent?.id, activeFilters, visibleColumns])

  const handleColumnChange = useCallback((
    type: 'basic' | 'metadata' | 'transcription_metrics' | 'metrics', 
    column: string, 
    visible: boolean
  ) => {
    setVisibleColumns(prev => ({
      ...prev,
      [type]: visible 
        ? [...prev[type], column]
        : prev[type].filter(col => col !== column)
    }))
  }, [setVisibleColumns])

  const handleSelectAll = useCallback((
    type: 'basic' | 'metadata' | 'transcription_metrics' | 'metrics', 
    visible: boolean
  ) => {
    setVisibleColumns(prev => ({
      ...prev,
      [type]: visible
        ? (type === "basic" 
            ? BASIC_COLUMNS.map(col => col.key) 
            : dynamicColumns[type] || [])
        : []
    }))
  }, [setVisibleColumns, dynamicColumns])

  const handleRowClick = useCallback((callId: string, agentId: string) => {
    // Save scroll position before navigation
    const scrollKey = `call-logs-scroll-${agent?.id}`
    if (scrollContainerRef.current) {
      sessionStorage.setItem(scrollKey, scrollContainerRef.current.scrollTop.toString())
    }
    router.push(`/${project?.id}/agents/${agentId}/observability?session_id=${callId}`)
  }, [router, project?.id, agent?.id])

  // Track selected call for highlighting
  const [selectedCallId, setSelectedCallId] = React.useState<string | null>(null)

  const handleRowSelect = useCallback((callId: string, agentId: string) => {
    setSelectedCallId(callId)
    handleRowClick(callId, agentId)
  }, [handleRowClick])

  // Persist selected call ID across navigation
  useEffect(() => {
    const selectedKey = `selected-call-${agent?.id}`
    const savedCallId = sessionStorage.getItem(selectedKey)
    if (savedCallId) {
      setSelectedCallId(savedCallId)
    }
  }, [agent?.id])

  useEffect(() => {
    const selectedKey = `selected-call-${agent?.id}`
    if (selectedCallId) {
      sessionStorage.setItem(selectedKey, selectedCallId)
    } else {
      sessionStorage.removeItem(selectedKey)
    }
  }, [selectedCallId, agent?.id])

  // Loading state
  if (parentLoading || roleLoading || !agent || !project || (isLoading && !calls.length)) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <FilterHeaderSkeleton />
        <TableSkeleton />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-none p-4 border-b bg-background/95 dark:bg-gray-900/95">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 rounded-lg flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              Unable to load calls
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Unable to load calls
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700 bg-background/95 dark:bg-gray-900/95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CallFilter 
              onFiltersChange={handleFiltersChange}
              onClear={handleClearFilters}
              availableMetadataFields={dynamicColumns.metadata}
              availableTranscriptionFields={dynamicColumns.transcription_metrics}
              initialFilters={activeFilters}
              distinctConfig={distinctConfig}
              onDistinctConfigChange={handleDistinctConfigChange}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefetching}
              className="h-8 w-8 p-0 shrink-0"
              aria-label="Refresh call logs"
            >
              <RefreshCw className={cn('h-3 w-3', (isLoading || isRefetching) && 'animate-spin')} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <ReanalyzeDialogWrapper projectId={project?.id} agentId={agent?.id} />
            <BackfillDispositionDialog 
              projectId={project?.id} 
              agentId={agent?.id}
              agentName={agent?.name}
              projectName={project?.name}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCSV}
              disabled={isLoading || !agent?.id}
            >
              Download CSV
            </Button>
            <ColumnSelector
              basicColumns={BASIC_COLUMNS.map((col) => col.key)}
              basicColumnLabels={Object.fromEntries(
                BASIC_COLUMNS.filter(col => !('hidden' in col && col.hidden)).map((col) => [col.key, col.label])
              )}
              metadataColumns={dynamicColumns.metadata}
              transcriptionColumns={dynamicColumns.transcription_metrics}
              metricsColumns={dynamicColumns.metrics}
              visibleColumns={visibleColumns}
              onColumnChange={handleColumnChange}
              onSelectAll={handleSelectAll}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={scrollContainerRef} className="absolute inset-0 overflow-auto">
          <table className="w-full border-collapse border-spacing-0">
            <thead className="sticky h-12 -top-1 z-20 bg-background dark:bg-gray-900 shadow-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-muted/80 dark:bg-gray-800/80">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 truncate border-2 border-r-black py-1.5 text-left font-semibold text-foreground dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-800 text-sm leading-tight"
                      style={{
                        minWidth: header.column.columnDef.minSize || 200,
                        width: header.column.columnDef.size || 'auto',
                        borderBottomWidth: '2px',
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody style={shouldVirtualize ? { height: totalHeight, position: 'relative' } : undefined}>
              {rows.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="h-[400px] text-center px-6 py-4">
                    <div className="flex flex-col items-center justify-center space-y-4 py-12">
                      <div className="rounded-full bg-muted/50 p-6">
                        <Inbox className="w-12 h-12 text-muted-foreground" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold">No call logs found</h3>
                        {activeFilters.length > 0 && (
                          <p className="text-sm text-muted-foreground max-w-md">
                            No call logs match your current filters. Try adjusting your filter criteria.
                          </p>
                        )}
                      </div>
                      {activeFilters.length > 0 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleClearFilters} 
                          className="mt-4"
                        >
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : shouldVirtualize ? (
                <>
                  {/* Top spacer to maintain scroll position */}
                  {offsetY > 0 && (
                    <tr>
                      <td colSpan={columns.length} style={{ height: offsetY, padding: 0, border: 'none' }} />
                    </tr>
                  )}
                  
                  {/* Visible rows */}
                  {visibleItems.length > 0 ? (
                    visibleItems.map((index) => {
                      const row = rows[index]
                      if (!row) return null
                      const isFirstRow = index === startIndex
                    
                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "cursor-pointer hover:bg-muted/30 dark:hover:bg-gray-800/50 transition-all border-b border-border/50 h-20",
                            selectedCallId === row.original.id && "bg-blue-100 dark:bg-blue-900/40"
                          )}
                          onClick={() => handleRowSelect(row.original.id, row.original.agent_id)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td 
                              key={cell.id} 
                              className={cn(
                                "px-4 py-1 text-sm border-2 dark:text-gray-100 border-gray-200 dark:border-gray-800 leading-tight h-20",
                                isFirstRow && "border-t-0"
                              )}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      )
                    })
                  ) : (
                    // Fallback: if visibleItems is empty, show first few rows
                    rows.slice(0, 20).map((row) => (
                      <tr
                        key={row.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/30 dark:hover:bg-gray-800/50 transition-all border-b border-border/50 h-20",
                          selectedCallId === row.original.id && "bg-blue-100 dark:bg-blue-900/40"
                        )}
                        onClick={() => handleRowSelect(row.original.id, row.original.agent_id)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td 
                            key={cell.id} 
                            className="px-4 py-1 text-sm border-2 dark:text-gray-100 border-gray-200 dark:border-gray-800 leading-tight h-20"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                  
                  {/* Bottom spacer to maintain scroll position */}
                  {endIndex < rows.length - 1 && (
                    <tr>
                      <td 
                        colSpan={columns.length} 
                        style={{ 
                          height: (rows.length - endIndex - 1) * ROW_HEIGHT, 
                          padding: 0, 
                          border: 'none' 
                        }} 
                      />
                    </tr>
                  )}
                </>
              ) : (
                // Render all rows when virtualization is disabled (small datasets)
                rows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/30 dark:hover:bg-gray-800/50 transition-all border-b border-border/50 h-20",
                      selectedCallId === row.original.id && "bg-blue-100 dark:bg-blue-900/40"
                    )}
                    onClick={() => handleRowSelect(row.original.id, row.original.agent_id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td 
                        key={cell.id} 
                        className={cn(
                          "px-4 py-1 text-sm border-2 dark:text-gray-100 border-gray-200 dark:border-gray-800 leading-tight h-20",
                          rowIndex === 0 && "border-t-0"
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Load More Trigger */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="py-6 border-t">
              {isLoading && (
                <div className="flex justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </div>
          )}

          {/* End of List */}
          {!hasNextPage && calls.length > 0 && (
            <div className="py-4 text-muted-foreground text-sm border-t text-center">
              All calls loaded ({calls.length} total)
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CallLogs
