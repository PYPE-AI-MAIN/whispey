"use client"

import React, { useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, Inbox, ChevronLeft, ChevronRight } from "lucide-react"
import CallFilter, { FilterOperation } from "../CallFilter"
import ColumnSelector from "../shared/ColumnSelector"
import { cn } from "@/lib/utils"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'

import { downloadCSV } from '@/utils/callLogsUtils'
import { useCallLogsData } from '@/hooks/useCallLogsData'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { canShowOrgSection } from '@/types/visibility'
import { useCallLogsColumns, BASIC_COLUMNS } from '@/hooks/useCallLogsColumns'
import { useCallLogsStore } from '@/stores/callLogsStore'
import { createTableColumns } from './tableColumns'
import {
  FilterHeaderSkeleton,
  TableSkeleton,
  ReanalyzeDialogWrapper
} from './sub-components'
import BackfillDispositionDialog from '@/components/disposition/BackfillDispositionDialog'

interface CallLogsProps {
  project: any
  agent: any
  onBack: () => void
  isLoading?: boolean
  dateRange?: { from: string; to: string }
}

// ── Smart pagination range ─────────────────────────────────────────────────
// totalKnown  = pages already loaded in cache
// totalPages  = exact total derived from count API (may be null if still loading)
// hasMore     = server still has pages beyond what's loaded
type PageItem = number | 'start-ellipsis' | 'end-ellipsis' | 'load-more'

function buildPageItems(
  currentPage: number,
  totalKnown: number,
  hasMore: boolean,
  totalPages: number | null,
): PageItem[] {
  // Use the real total if available, otherwise fall back to loaded + maybe-more
  const last = totalPages ?? (hasMore ? null : totalKnown)
  if (!last && totalKnown <= 0) return []

  const effectiveLast = last ?? totalKnown

  // If everything fits in ≤7 buttons, show all
  if (effectiveLast <= 7 && !hasMore) {
    return Array.from({ length: effectiveLast }, (_, i) => i + 1)
  }

  const items: PageItem[] = []
  const addUniq = (p: PageItem) => { if (!items.includes(p)) items.push(p) }

  // First page always shown
  addUniq(1)

  // Left ellipsis when current is far from start
  if (currentPage > 3) addUniq('start-ellipsis')

  // Current window: page−1, current, page+1 (clamped)
  const lo = Math.max(2, currentPage - 1)
  const hi = Math.min(effectiveLast - 1, currentPage + 1)
  for (let p = lo; p <= hi; p++) addUniq(p)

  // Right ellipsis when current is far from last known page
  if (currentPage < effectiveLast - 2) addUniq('end-ellipsis')

  // Last page always shown
  if (effectiveLast > 1) addUniq(effectiveLast)

  // If there are still more pages beyond the total we know, show a load-more "…"
  // (only relevant when totalPages is null and hasMore is true)
  if (!totalPages && hasMore) addUniq('load-more')

  return items
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
  const { resolvedTheme } = useTheme()

  const flaggedRowStyle: React.CSSProperties = {
    backgroundColor: resolvedTheme === 'dark' ? 'rgba(136, 19, 55, 0.18)' : '#fff1f2',
  }

  const {
    calls,
    currentPageCalls,
    currentPage,
    totalCount,
    totalPages,
    isFirstPage,
    isLastPage,
    hasNextPage,
    goToNextPage,
    goToPrevPage,
    goToPage,
    role,
    roleLoading,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    error,
    activeFilters,
    setActiveFilters,
    refetch,
  } = useCallLogsData(agent, userEmail, project?.id, dateRange, user?.id)

  const { visibility } = useMemberVisibility(project?.id ?? undefined)
  const canReanalyze = canShowOrgSection(visibility, 'reanalyze')

  const { distinctConfigByAgent, setDistinctConfigForAgent } = useCallLogsStore()
  const distinctConfig = agent?.id ? distinctConfigByAgent[agent.id] : undefined
  const setDistinctConfig = useCallback(
    (config: typeof distinctConfig) => {
      if (agent?.id) setDistinctConfigForAgent(agent.id, config)
    },
    [agent?.id, setDistinctConfigForAgent]
  )

  const {
    visibleColumns,
    setVisibleColumns,
    dynamicColumns,
    filteredBasicColumns
  } = useCallLogsColumns(agent, calls, role)

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    calls.forEach(call => {
      const tags = call.transcription_metrics?.tags
      if (Array.isArray(tags)) tags.forEach((t: string) => tagSet.add(t))
    })
    return Array.from(tagSet).sort()
  }, [calls])

  const columns = useMemo(
    () => createTableColumns(visibleColumns, { availableTags, onTagsUpdated: refetch, role }),
    [visibleColumns, availableTags, refetch, role]
  )

  const table = useReactTable({
    data: currentPageCalls,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const rows = table.getRowModel().rows

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFiltersChange = useCallback((ops: FilterOperation[]) => {
    setActiveFilters(ops)
  }, [setActiveFilters])

  const handleClearFilters = useCallback(() => setActiveFilters([]), [setActiveFilters])

  const handleDistinctConfigChange = useCallback((config: typeof distinctConfig) => {
    setDistinctConfig(config)
  }, [setDistinctConfig])

  // Refresh always goes back to page 1 (handled inside hook's refetch)
  const handleRefresh = useCallback(async () => {
    if (isRefetching) return
    await refetch()
  }, [refetch, isRefetching])

  const handleDownloadCSV = useCallback(async () => {
    if (!agent?.id) return
    try {
      await downloadCSV(agent.id, activeFilters, {
        basic: visibleColumns.basic,
        metadata: visibleColumns.metadata,
        transcription_metrics: visibleColumns.transcription_metrics
      }, project?.id)
    } catch (err) {
      alert((err as Error).message)
    }
  }, [agent?.id, activeFilters, visibleColumns, project?.id])

  const handleColumnChange = useCallback((
    type: 'basic' | 'metadata' | 'transcription_metrics' | 'metrics',
    column: string, visible: boolean
  ) => {
    setVisibleColumns(prev => ({
      ...prev,
      [type]: visible ? [...prev[type], column] : prev[type].filter(c => c !== column)
    }))
  }, [setVisibleColumns])

  const handleSelectAll = useCallback((
    type: 'basic' | 'metadata' | 'transcription_metrics' | 'metrics',
    visible: boolean
  ) => {
    setVisibleColumns(prev => ({
      ...prev,
      [type]: visible
        ? (type === "basic" ? BASIC_COLUMNS.map(c => c.key) : dynamicColumns[type] || [])
        : []
    }))
  }, [setVisibleColumns, dynamicColumns])

  // Restore last-selected call when returning from log detail
  const sessionKey = agent?.id ? `call-logs-selected-${agent.id}` : null
  const [selectedCallId, setSelectedCallId] = React.useState<string | null>(() => {
    if (!sessionKey) return null
    return sessionStorage.getItem(sessionKey) ?? null
  })

  const handleRowSelect = useCallback((callId: string, callAgentId: string) => {
    setSelectedCallId(callId)
    // Persist so the highlight is restored when the user presses Back
    if (sessionKey) sessionStorage.setItem(sessionKey, callId)
    // Let React flush the highlight re-render, then navigate
    setTimeout(() => {
      router.push(`/${project?.id}/agents/${callAgentId}/observability?session_id=${callId}`)
    }, 120)
  }, [router, project?.id, sessionKey])

  // ── Pagination items ───────────────────────────────────────────────────────
  // totalPages comes from the hook (null when filters active or count not yet loaded)
  const pageItems = buildPageItems(currentPage, currentPage, hasNextPage, totalPages)

  const pageStart = (currentPage - 1) * 50 + 1
  const pageEnd   = (currentPage - 1) * 50 + currentPageCalls.length

  // ── Loading / error guards ─────────────────────────────────────────────────
  if (parentLoading || roleLoading || !agent || !project || (isLoading && !currentPageCalls.length)) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <FilterHeaderSkeleton />
        <TableSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-none p-4 border-b bg-background/95 dark:bg-gray-900/95">
          <div className="h-8 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 rounded-lg flex items-center w-fit">
            <AlertCircle className="w-4 h-4 mr-2" />
            Unable to load calls
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-semibold">{error}</h3>
            {activeFilters.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Clear filters and retry
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-900">

      {/* ── Header ────────────────────────────────────────────────────────── */}
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
              role={role}
            />
            <Button
              variant="outline" size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefetching || isFetchingNextPage}
              className="h-8 w-8 p-0 shrink-0"
              aria-label="Refresh call logs"
            >
              <RefreshCw className={cn('h-3 w-3', (isLoading || isRefetching) && 'animate-spin')} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {canReanalyze && <ReanalyzeDialogWrapper projectId={project?.id} agentId={agent?.id} />}
            <BackfillDispositionDialog
              projectId={project?.id} agentId={agent?.id}
              agentName={agent?.name} projectName={project?.name}
            />
            <Button
              variant="outline" size="sm"
              onClick={handleDownloadCSV}
              disabled={isLoading || !agent?.id}
            >
              Download CSV
            </Button>
            <ColumnSelector
              basicColumns={filteredBasicColumns.map(c => c.key)}
              basicColumnLabels={Object.fromEntries(filteredBasicColumns.map(c => [c.key, c.label]))}
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

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 overflow-auto">
          <table className="w-full border-collapse border-spacing-0">
            <thead className="sticky h-12 -top-1 z-20 bg-background dark:bg-gray-900 shadow-sm">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="bg-muted/80 dark:bg-gray-800/80">
                  {hg.headers.map(h => (
                    <th
                      key={h.id}
                      className="px-6 truncate border-2 border-r-black py-1.5 text-left font-semibold text-foreground dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-800 text-sm leading-tight"
                      style={{ minWidth: h.column.columnDef.minSize || 200, width: h.column.columnDef.size || 'auto' }}
                    >
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="h-[400px] text-center">
                    <div className="flex flex-col items-center justify-center space-y-4 py-12">
                      <div className="rounded-full bg-muted/50 p-6">
                        <Inbox className="w-12 h-12 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No call logs found</h3>
                      {activeFilters.length > 0 && (
                        <>
                          <p className="text-sm text-muted-foreground max-w-md">
                            No calls match your current filters.
                          </p>
                          <Button variant="outline" size="sm" onClick={handleClearFilters}>
                            Clear Filters
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => {
                  const isFlagged = Boolean(row.original.transcription_metrics?.flag?.text)
                  const isSelected = selectedCallId === row.original.id
                  return (
                    <tr
                      key={row.id}
                      style={
                        isSelected ? undefined
                        : isFlagged ? flaggedRowStyle : undefined
                      }
                      className={cn(
                        "cursor-pointer transition-colors border-b border-border/50 h-20",
                        !isSelected && (isFlagged
                          ? "hover:brightness-95"
                          : "hover:bg-muted/30 dark:hover:bg-gray-800/50"
                        ),
                      )}
                      onClick={() => handleRowSelect(row.original.id, row.original.agent_id)}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-4 py-1 text-sm border-2 dark:text-gray-100 border-gray-200 dark:border-gray-800 leading-tight h-20",
                            rowIndex === 0 && "border-t-0",
                            // highlight must be on <td> — tr bg doesn't always show through bordered cells
                            isSelected && "bg-blue-100 dark:bg-blue-900/40",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination bar ────────────────────────────────────────────────── */}
      <div className="flex-none flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-background/95 dark:bg-gray-900/95">

        {/* Row range label */}
        <span className="text-sm text-muted-foreground min-w-[100px]">
          {currentPageCalls.length > 0
            ? totalCount !== null
              ? `${pageStart.toLocaleString()}–${pageEnd.toLocaleString()} of ${totalCount.toLocaleString()}`
              : `${pageStart}–${pageEnd}`
            : '—'
          }
        </span>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {/* Prev button */}
          <Button
            variant="ghost" size="sm"
            className="h-8 w-8 p-0"
            disabled={isFirstPage || isLoading}
            onClick={goToPrevPage}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {pageItems.map((item, idx) => {
            if (item === 'start-ellipsis' || item === 'end-ellipsis') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground select-none">
                  …
                </span>
              )
            }

            if (item === 'load-more') {
              return (
                <Button
                  key="load-more"
                  variant="ghost" size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground"
                  disabled={isFetchingNextPage}
                  onClick={goToNextPage}
                  aria-label="Load more pages"
                >
                  {isFetchingNextPage
                    ? <RefreshCw className="h-3 w-3 animate-spin" />
                    : <span className="text-sm">…</span>
                  }
                </Button>
              )
            }

            const pageNum = item as number
            const isActive = pageNum === currentPage
            return (
              <Button
                key={pageNum}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 text-sm font-medium",
                  isActive && "pointer-events-none"
                )}
                disabled={isLoading}
                onClick={() => goToPage(pageNum)}
                aria-label={`Page ${pageNum}`}
                aria-current={isActive ? "page" : undefined}
              >
                {pageNum}
              </Button>
            )
          })}

          {/* Next button */}
          <Button
            variant="ghost" size="sm"
            className="h-8 w-8 p-0"
            disabled={isLastPage || isFetchingNextPage}
            onClick={goToNextPage}
            aria-label="Next page"
          >
            {isFetchingNextPage
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <ChevronRight className="h-4 w-4" />
            }
          </Button>
        </div>

        {/* Total count / page indicator */}
        <span className="text-xs text-muted-foreground min-w-[100px] text-right">
          {totalCount !== null
            ? `${totalCount.toLocaleString()} total · ${totalPages} pages`
            : hasNextPage
            ? `page ${currentPage}+`
            : currentPageCalls.length > 0
            ? `${currentPageCalls.length} on page`
            : null
          }
        </span>
      </div>
    </div>
  )
}

export default CallLogs
