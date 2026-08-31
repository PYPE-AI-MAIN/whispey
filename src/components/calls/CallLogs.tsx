"use client"

import React, { useCallback, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, Inbox, ChevronLeft, ChevronRight, Settings } from "lucide-react"
import CallFilter, { FilterOperation } from "../CallFilter"
import ColumnSelector from "../shared/ColumnSelector"
import { cn } from "@/lib/utils"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'

import { isRowFlaggedForRole } from '@/utils/callLogsUtils'
import { useCallLogsData } from '@/hooks/useCallLogsData'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { canShowOrgSection } from '@/types/visibility'
import { useCallLogsColumns, BASIC_COLUMNS, EXTRA_RESTRICTABLE_COLUMNS } from '@/hooks/useCallLogsColumns'
import { useGlobalRole } from '@/hooks/useGlobalRole'
import DownloadDialog from './DownloadDialog'
import DownloadSettingsDialog from './DownloadSettingsDialog'
import { useQuery } from '@tanstack/react-query'
import { useCallLogsStore } from '@/stores/callLogsStore'
import { agentDisplayName } from '@/lib/agentDisplayName'
import { createTableColumns } from './tableColumns'
import {
  FilterHeaderSkeleton,
  TableSkeleton,
  ReanalyzeDialogWrapper
} from './sub-components'
import BackfillDispositionDialog from '@/components/disposition/BackfillDispositionDialog'
import { CampaignSelector } from './CampaignSelector'
import type { Campaign } from './CampaignSelector'
import CampaignCallLogs from './CampaignCallLogs'

interface CallLogsProps {
  project: any
  agent: any
  onBack: () => void
  isLoading?: boolean
  dateRange?: { from: string; to: string }
  openDownloadSettings?: boolean
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

// ── Extracted formatting helpers (kept out of the component body to hold its
// cognitive complexity down — each replaces a nested/chained ternary) ───────

function formatRowRangeLabel(
  currentPageCallsLength: number,
  totalCount: number | null,
  pageStart: number,
  pageEnd: number
): string {
  if (currentPageCallsLength === 0) return '—'
  if (totalCount !== null) return `${pageStart.toLocaleString()}–${pageEnd.toLocaleString()} of ${totalCount.toLocaleString()}`
  return `${pageStart}–${pageEnd}`
}

function formatTotalCountLabel(
  totalCount: number | null,
  totalPages: number | null,
  hasNextPage: boolean,
  currentPage: number,
  currentPageCallsLength: number
): string | null {
  if (totalCount !== null) return `${totalCount.toLocaleString()} total · ${totalPages} pages`
  if (hasNextPage) return `page ${currentPage}+`
  if (currentPageCallsLength > 0) return `${currentPageCallsLength} on page`
  return null
}

function getHeaderCellClassName(headerId: string): string {
  const base = "px-6 truncate border-2 border-r-black border-b-2 border-gray-200 dark:border-gray-800 py-1.5 text-left font-semibold text-sm leading-tight"
  if (headerId.startsWith('transcription-')) {
    return cn(base, "text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-900/10")
  }
  if (headerId.startsWith('metrics-')) {
    return cn(base, "text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/10")
  }
  return cn(base, "text-foreground dark:text-gray-100")
}

function getRowStyle(
  isSelected: boolean,
  isFlagged: boolean,
  flaggedRowStyle: React.CSSProperties
): React.CSSProperties | undefined {
  if (isSelected) return undefined
  return isFlagged ? flaggedRowStyle : undefined
}

function getRowClassName(isNavigatingRow: boolean, isSelected: boolean, isFlagged: boolean): string {
  return cn(
    "cursor-pointer transition-colors border-b border-border/50 h-20",
    isNavigatingRow && "pointer-events-none",
    !isSelected && (isFlagged
      ? "hover:brightness-95"
      : "hover:bg-muted/30 dark:hover:bg-gray-800/50"
    ),
  )
}

function getCellClassName(rowIndex: number, isSelected: boolean, cellColumnId: string): string {
  return cn(
    "px-4 py-1 text-sm border-2 dark:text-gray-100 border-gray-200 dark:border-gray-800 leading-tight h-20",
    rowIndex === 0 && "border-t-0",
    !isSelected && cellColumnId.startsWith('transcription-') && "dark:bg-purple-900/10",
    !isSelected && cellColumnId.startsWith('metrics-') && "dark:bg-blue-900/10",
    isSelected && "bg-blue-100 dark:bg-blue-900/40",
  )
}

function renderPageItem(
  item: PageItem,
  idx: number,
  currentPage: number,
  isFetchingNextPage: boolean,
  isLoading: boolean,
  goToPage: (page: number) => void,
  goToNextPage: () => void
) {
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

  const pageNum = item
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
}

function renderTableRows(
  rows: any[],
  isLoading: boolean,
  activeFilters: FilterOperation[],
  handleClearFilters: () => void,
  columnsLength: number,
  role: any,
  selectedCallId: string | null,
  navigatingCallId: string | null,
  flaggedRowStyle: React.CSSProperties,
  handleRowSelect: (callId: string, callAgentId: string) => void
) {
  if (rows.length === 0 && !isLoading) {
    return (
      <tr>
        <td colSpan={columnsLength} className="h-[400px] text-center">
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
    )
  }

  return rows.map((row, rowIndex) => {
    const isFlagged = isRowFlaggedForRole(row.original, role)
    const isSelected = selectedCallId === row.original.id
    const isNavigatingRow = navigatingCallId === row.original.id
    return (
      <tr
        key={row.id}
        data-call-id={row.original.id}
        style={getRowStyle(isSelected, isFlagged, flaggedRowStyle)}
        className={getRowClassName(isNavigatingRow, isSelected, isFlagged)}
        onClick={() => handleRowSelect(row.original.id, row.original.agent_id)}
      >
        {row.getVisibleCells().map((cell: any) => (
          <td
            key={cell.id}
            className={getCellClassName(rowIndex, isSelected, cell.column.id)}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    )
  })
}

// ── Extracted hooks (kept out of the component body to hold its cognitive
// complexity down) ──────────────────────────────────────────────────────────

function useAgentDownloadSettingsQuery(agentId: string | undefined) {
  return useQuery({
    queryKey: ['download-settings', agentId],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/download-settings`)
      if (!res.ok) throw new Error('Failed to load download settings')
      return res.json() as Promise<{
        enabled: boolean
        isSuperAdmin: boolean
        canDownload: boolean
        hiddenColumns: string[]
        hiddenDownloadColumns: string[]
        settings?: { enabled: boolean; superadmin_only_columns: string[] }
      }>
    },
    enabled: !!agentId,
    staleTime: 60_000,
  })
}

function useColumnVisibilityHandlers(
  setVisibleColumns: React.Dispatch<React.SetStateAction<any>>,
  dynamicColumns: Record<string, string[]>
) {
  const handleColumnChange = useCallback((
    type: 'basic' | 'metadata' | 'transcription_metrics' | 'metrics',
    column: string, visible: boolean
  ) => {
    setVisibleColumns((prev: any) => ({
      ...prev,
      [type]: visible ? [...prev[type], column] : prev[type].filter((c: string) => c !== column)
    }))
  }, [setVisibleColumns])

  const handleSelectAll = useCallback((
    type: 'basic' | 'metadata' | 'transcription_metrics' | 'metrics',
    visible: boolean
  ) => {
    setVisibleColumns((prev: any) => ({
      ...prev,
      [type]: visible
        ? (type === "basic" ? BASIC_COLUMNS.map(c => c.key) : dynamicColumns[type] || [])
        : []
    }))
  }, [setVisibleColumns, dynamicColumns])

  return { handleColumnChange, handleSelectAll }
}

// Restore last-selected call when returning from log detail, and keep the
// selected row centred in view across a Back navigation. Extracted as its own
// hook so its internal branching doesn't count against CallLogs's complexity.
function useRowNavigation(
  agentId: string | undefined,
  projectId: string | undefined,
  router: ReturnType<typeof useRouter>,
  isLoading: boolean,
  currentPageCalls: any[]
) {
  const sessionKey = agentId ? `call-logs-selected-${agentId}` : null
  const [selectedCallId, setSelectedCallId] = React.useState<string | null>(() => {
    if (!sessionKey) return null
    return sessionStorage.getItem(sessionKey) ?? null
  })

  const [navigatingCallId, setNavigatingCallId] = React.useState<string | null>(null)

  // Bring the selected row back into view when returning from log detail. We don't store scroll
  // offsets at all — the selected row is already known + highlighted, so we just find it by id and
  // scroll it into the middle of the viewport. Naturally robust to new logs shifting rows around.
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleRowSelect = useCallback((callId: string, callAgentId: string) => {
    if (navigatingCallId) return  // already navigating, ignore double-clicks
    setSelectedCallId(callId)
    setNavigatingCallId(callId)
    // Persist so the highlight is restored when the user presses Back
    if (sessionKey) sessionStorage.setItem(sessionKey, callId)
    // Let React flush the highlight + spinner, then navigate
    setTimeout(() => {
      router.push(`/${projectId}/agents/${callAgentId}/observability?session_id=${callId}`)
    }, 120)
  }, [router, projectId, sessionKey, navigatingCallId])

  // Which call id we've already settled the scroll for — so we only restore once per return.
  const scrolledForId = useRef<string | null>(null)

  // Diagnosis (from real DOM state on Back): the scroll container and the highlighted row are both
  // correct and present, yet scrollTop lands at exactly 0 — i.e. a late render/layout pass snaps the
  // list back to the top AFTER we scroll. A single scrollIntoView loses that race. So we keep the row
  // centred across the settling window, and back off the instant the user scrolls so we never fight them.
  const keepSelectedCentred = useCallback(() => {
    const wantId = selectedCallId
    if (!wantId) return

    let userScrolled = false
    const onUserScroll = () => { userScrolled = true }
    // Only genuine user gestures count — programmatic scrollIntoView doesn't fire these.
    const container = scrollContainerRef.current
    container?.addEventListener('wheel', onUserScroll, { passive: true })
    container?.addEventListener('touchstart', onUserScroll, { passive: true })
    globalThis.addEventListener('keydown', onUserScroll)

    const startedAt = performance.now()
    let rafId = 0
    const tick = () => {
      if (userScrolled || selectedCallId !== wantId) return cleanup()
      const c = scrollContainerRef.current
      const target = c?.querySelector<HTMLElement>(`[data-call-id="${CSS.escape(wantId)}"]`)
      if (c && target) {
        const rowCentre = target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2
        const viewCentre = c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2
        if (Math.abs(rowCentre - viewCentre) > 8) {
          target.scrollIntoView({ block: 'center' })
          scrolledForId.current = wantId
        }
      }
      // Watch ~1.5s — long enough to outlast the mount/settle resets, short enough to feel instant.
      if (performance.now() - startedAt < 1500) rafId = requestAnimationFrame(tick)
      else cleanup()
    }
    const cleanup = () => {
      cancelAnimationFrame(rafId)
      container?.removeEventListener('wheel', onUserScroll)
      container?.removeEventListener('touchstart', onUserScroll)
      globalThis.removeEventListener('keydown', onUserScroll)
    }
    rafId = requestAnimationFrame(tick)
    return cleanup
  }, [selectedCallId])

  // "First let it load, then scroll." Wait until the list has genuinely finished loading and rows are
  // on screen, THEN start centring the selected row. Re-runs whenever load state / data / selection
  // changes, so a Back-triggered refetch or the role-gate resolving both kick it off correctly.
  React.useEffect(() => {
    if (isLoading || !selectedCallId || currentPageCalls.length === 0) return
    if (scrolledForId.current === selectedCallId) return
    return keepSelectedCentred()
  }, [isLoading, currentPageCalls, selectedCallId, keepSelectedCentred])

  // Back navigation, two channels:
  //  • popstate  — the in-app Back button (router.back()) and same-document history pops.
  //  • pageshow  — the browser's own Back/Forward, which often restores from the bfcache WITHOUT
  //                firing popstate or remounting; without this, browser-Back wouldn't re-centre.
  // Both reset the guard and re-run the centring so the row is restored regardless of how we returned.
  React.useEffect(() => {
    const handleReturn = () => {
      scrolledForId.current = null
      keepSelectedCentred()
    }
    globalThis.addEventListener('popstate', handleReturn)
    globalThis.addEventListener('pageshow', handleReturn)
    return () => {
      globalThis.removeEventListener('popstate', handleReturn)
      globalThis.removeEventListener('pageshow', handleReturn)
    }
  }, [keepSelectedCentred])

  return { selectedCallId, navigatingCallId, scrollContainerRef, handleRowSelect }
}

const CallLogs: React.FC<CallLogsProps> = ({
  project,
  agent,
  onBack,
  isLoading: parentLoading,
  dateRange,
  openDownloadSettings
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
    refetchCurrentPage,
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
    () => createTableColumns(visibleColumns, { availableTags, onTagsUpdated: refetchCurrentPage, role }),
    [visibleColumns, availableTags, refetchCurrentPage, role]
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

  const [campaignDownloadOpen, setCampaignDownloadOpen] = useState(false)
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [downloadSettingsOpen, setDownloadSettingsOpen] = useState(!!openDownloadSettings)

  // Auto-open the download settings dialog when navigated here with the
  // ?openDownloadSettings=1 query param (e.g. from the per-user column access
  // page's "manage this in the agent's Download Settings" link).
  React.useEffect(() => {
    if (openDownloadSettings) setDownloadSettingsOpen(true)
  }, [openDownloadSettings])

  const { isSuperAdmin } = useGlobalRole()

  const { data: downloadSettingsData, refetch: refetchDownloadSettings } = useAgentDownloadSettingsQuery(agent?.id)

  const { selectedCampaignByAgent, setSelectedCampaignForAgent } = useCallLogsStore()
  const selectedCampaign = agent?.id ? (selectedCampaignByAgent[agent.id] ?? null) : null
  const setSelectedCampaign = useCallback((c: Campaign | null) => {
    if (agent?.id) setSelectedCampaignForAgent(agent.id, c)
  }, [agent?.id, setSelectedCampaignForAgent])

  const { handleColumnChange, handleSelectAll } = useColumnVisibilityHandlers(setVisibleColumns, dynamicColumns)

  // Restore last-selected call when returning from log detail, and keep the selected row
  // centred in view across a Back navigation.
  const { selectedCallId, navigatingCallId, scrollContainerRef, handleRowSelect } =
    useRowNavigation(agent?.id, project?.id, router, isLoading, currentPageCalls)

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
      <div className="flex-none relative p-4 border-b border-gray-200 dark:border-gray-700 bg-background/95 dark:bg-gray-900/95">
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
            {project?.id && (
              <CampaignSelector
                projectId={project.id}
                agentId={agent?.id ?? ''}
                selectedCampaign={selectedCampaign}
                onSelect={setSelectedCampaign}
              />
            )}
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
              agentName={agentDisplayName(agent)} projectName={project?.name}
            />
            {(downloadSettingsData?.canDownload || isSuperAdmin) && (
              <div className="relative flex items-center gap-1">
                <Button
                  variant="outline" size="sm"
                  onClick={selectedCampaign ? () => setCampaignDownloadOpen(true) : () => setDownloadDialogOpen(true)}
                  disabled={!selectedCampaign && (isLoading || !agent?.id)}
                  className="min-w-[120px] overflow-hidden"
                >
                  Download CSV
                </Button>
                {isSuperAdmin && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setDownloadSettingsOpen(true)}
                    className="h-8 w-8 p-0 shrink-0"
                    aria-label="Download settings"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
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

      {/* ── Campaign view (replaces table when a campaign is selected) ─────── */}
      {selectedCampaign && (
        <CampaignCallLogs
          agent={agent}
          project={project}
          campaign={selectedCampaign}
          visibleColumns={visibleColumns}
          availableTags={availableTags}
          role={role}
          filters={activeFilters}
          downloadDialogOpen={campaignDownloadOpen}
          onDownloadDialogOpenChange={setCampaignDownloadOpen}
        />
      )}

      {/* ── Normal table + pagination (hidden when campaign view is active) ─── */}
      {!selectedCampaign && <>
        <div className="flex-1 relative overflow-hidden">
          {/* Thin progress bar — shown while changing pages */}
          <div
            className={cn(
              "absolute top-0 left-0 right-0 h-[2px] z-30 overflow-hidden transition-opacity duration-200",
              (isFetchingNextPage || isRefetching) ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <div className="h-full bg-blue-500 dark:bg-blue-400 animate-[progress-slide_1.2s_ease-in-out_infinite]" />
          </div>

          <div
            ref={scrollContainerRef}
            className={cn(
              "absolute inset-0 overflow-auto transition-opacity duration-150",
              (isFetchingNextPage || isRefetching) && "opacity-60 pointer-events-none"
            )}
          >
            <table className="w-full border-collapse border-spacing-0">
              <thead className="sticky h-12 -top-1 z-20 bg-background dark:bg-gray-900 shadow-sm">
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id} className="bg-muted/80 dark:bg-gray-800/80">
                    {hg.headers.map(h => (
                      <th
                        key={h.id}
                        className={getHeaderCellClassName(h.id)}
                        style={{ minWidth: h.column.columnDef.minSize || 200, width: h.column.columnDef.size || 'auto' }}
                      >
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {renderTableRows(
                  rows,
                  isLoading,
                  activeFilters,
                  handleClearFilters,
                  columns.length,
                  role,
                  selectedCallId,
                  navigatingCallId,
                  flaggedRowStyle,
                  handleRowSelect
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pagination bar ────────────────────────────────────────────────── */}
        <div className="flex-none flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-background/95 dark:bg-gray-900/95">

          {/* Row range label */}
          <span className="text-sm text-muted-foreground min-w-[100px]">
            {formatRowRangeLabel(currentPageCalls.length, totalCount, pageStart, pageEnd)}
          </span>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm"
              className="h-8 w-8 p-0"
              disabled={isFirstPage || isLoading}
              onClick={goToPrevPage}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {pageItems.map((item, idx) =>
              renderPageItem(item, idx, currentPage, isFetchingNextPage, isLoading, goToPage, goToNextPage)
            )}

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
            {formatTotalCountLabel(totalCount, totalPages, hasNextPage, currentPage, currentPageCalls.length)}
          </span>
        </div>
      </>}

      {agent?.id && (
        <DownloadDialog
          open={downloadDialogOpen}
          onOpenChange={setDownloadDialogOpen}
          agentId={agent.id}
          projectId={project?.id}
          activeFilters={activeFilters}
          basicColumns={filteredBasicColumns}
          metadataColumns={dynamicColumns.metadata}
          transcriptionColumns={dynamicColumns.transcription_metrics}
          hiddenColumns={downloadSettingsData?.hiddenDownloadColumns ?? downloadSettingsData?.hiddenColumns ?? []}
          initialDateRange={dateRange}
        />
      )}

      {agent?.id && isSuperAdmin && (
        <DownloadSettingsDialog
          open={downloadSettingsOpen}
          onOpenChange={setDownloadSettingsOpen}
          agentId={agent.id}
          allColumns={[...BASIC_COLUMNS, ...EXTRA_RESTRICTABLE_COLUMNS].map(c => ({ key: c.key, label: c.label }))}
          initialEnabled={downloadSettingsData?.settings?.enabled ?? true}
          initialSuperadminOnlyColumns={downloadSettingsData?.settings?.superadmin_only_columns ?? []}
          onSaved={() => refetchDownloadSettings()}
        />
      )}
    </div>
  )
}

export default CallLogs
