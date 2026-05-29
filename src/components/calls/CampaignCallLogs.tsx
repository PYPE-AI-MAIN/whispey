'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from '@tanstack/react-table'
import { ChevronDown, ChevronRight, ChevronLeft, RefreshCw, Loader2, Inbox, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import type { CallLog } from '@/types/logs'
import { createTableColumns } from './tableColumns'
import { useCampaignGroupedLogs, CAMPAIGN_PAGE_SIZE } from '@/hooks/useCampaignGroupedLogs'
import { flattenCallLogForCSV, DownloadProgress } from '@/utils/callLogsUtils'
import { downloadCSV } from '@/utils/callLogsUtils'
import type { FilterOperation } from '@/components/CallFilter'
import Papa from 'papaparse'
import type { Campaign } from './CampaignSelector'

// ── Sub-rows for expanded contact (renders <tr> elements into parent tbody) ─
interface ContactCallsRowsProps {
  subRows: CallLog[]
  dataCols: ColumnDef<CallLog>[]
  colCount: number
  onNavigate: (callId: string, agentId: string) => void
}

const ContactCallsRows: React.FC<ContactCallsRowsProps> = ({
  subRows, dataCols, colCount, onNavigate,
}) => {
  const subTable = useReactTable({
    data: subRows,
    columns: dataCols,
    getCoreRowModel: getCoreRowModel(),
  })

  const { resolvedTheme } = useTheme()
  const subBg = resolvedTheme === 'dark' ? '#1e3a5f' : '#dbeafe'
  const flaggedStyle: React.CSSProperties = {
    backgroundColor: resolvedTheme === 'dark' ? 'rgba(136, 19, 55, 0.18)' : '#fff1f2',
  }

  if (subRows.length === 0) {
    return (
      <tr>
        <td colSpan={colCount} style={{ backgroundColor: subBg }} className="py-2 pl-14 text-sm text-muted-foreground italic border-b border-border/30">
          No previous attempts
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr>
        <td
          colSpan={colCount}
          style={{ backgroundColor: subBg }}
          className="py-1 pl-4 pr-4 border-b border-blue-200 dark:border-blue-800 border-l-4 border-l-blue-500"
        >
          <span className="pl-10 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            {subRows.length} previous attempt{subRows.length !== 1 ? 's' : ''}
          </span>
        </td>
      </tr>
      {subTable.getRowModel().rows.map(row => {
        const isFlagged = Boolean(row.original.transcription_metrics?.flag?.text)
        return (
          <tr
            key={row.id}
            style={isFlagged ? flaggedStyle : undefined}
            className={cn(
              'cursor-pointer border-b border-border/30 h-16 transition-colors',
              isFlagged ? 'hover:brightness-95' : 'hover:brightness-95'
            )}
            onClick={() => onNavigate(row.original.id, row.original.agent_id)}
          >
            <td style={{ backgroundColor: subBg }} className="w-12 pl-4 border-r-0 border-l-4 border-l-blue-500">
              <div className="ml-3 w-0.5 h-8 rounded-full bg-blue-400 dark:bg-blue-500" />
            </td>
            {row.getVisibleCells().map(cell => (
              <td
                key={cell.id}
                style={{ backgroundColor: subBg }}
                className="px-4 py-1 text-sm dark:text-gray-200 border-r border-border/20 h-16"
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
interface CampaignCallLogsProps {
  agent: any
  project: any
  campaign: Campaign
  visibleColumns: { basic: string[]; metadata: string[]; transcription_metrics: string[]; metrics: string[] }
  availableTags: string[]
  role: string | null
  filters?: FilterOperation[]
  downloadDialogOpen?: boolean
  onDownloadDialogOpenChange?: (open: boolean) => void
}

const CampaignCallLogs: React.FC<CampaignCallLogsProps> = ({
  agent, project, campaign, visibleColumns, availableTags, role, filters = [],
  downloadDialogOpen, onDownloadDialogOpenChange,
}) => {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const flaggedRowStyle: React.CSSProperties = {
    backgroundColor: resolvedTheme === 'dark' ? 'rgba(136, 19, 55, 0.18)' : '#fff1f2',
  }

  const [expandedNumbers, setExpandedNumbers] = useState<Set<string>>(new Set())
  const [navigatingCallId, setNavigatingCallId] = useState<string | null>(null)

  useEffect(() => {
    setExpandedNumbers(new Set())
    setNavigatingCallId(null)
  }, [campaign.campaignId])

  // Dialog open state — controlled externally (top Download button) or internally
  const [internalDialogOpen, setInternalDialogOpen] = useState(false)
  const dialogOpen = downloadDialogOpen !== undefined ? downloadDialogOpen : internalDialogOpen
  const setDialogOpen = useCallback((open: boolean) => {
    setInternalDialogOpen(open)
    onDownloadDialogOpenChange?.(open)
  }, [onDownloadDialogOpenChange])

  const [dlType, setDlType] = useState<'last' | 'all'>('last')
  const [dlProgress, setDlProgress] = useState<DownloadProgress | null>(null)
  const [dlRunning, setDlRunning] = useState(false)

  const {
    rows,
    countsMap,
    currentPage,
    isFirstPage,
    isLastPage,
    hasNextPage,
    goToNextPage,
    goToPrevPage,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    error,
    refetch,
  } = useCampaignGroupedLogs({
    agentId: agent?.id,
    campaignId: campaign.campaignId,
    filters,
  })

  const toggleExpand = useCallback((customerNumber: string) => {
    setExpandedNumbers(prev => {
      const next = new Set(prev)
      if (next.has(customerNumber)) next.delete(customerNumber)
      else next.add(customerNumber)
      return next
    })
  }, [])

  const handleNavigate = useCallback((callId: string, agentId: string) => {
    if (navigatingCallId) return
    setNavigatingCallId(callId)
    setTimeout(() => {
      router.push(`/${project?.id}/agents/${agentId}/observability?session_id=${callId}`)
    }, 120)
  }, [router, project?.id, navigatingCallId])

  const handleDownload = useCallback(async () => {
    if (dlRunning) return
    setDlRunning(true)
    setDlProgress({ fetched: 0, total: null, phase: 'fetching' })

    try {
      if (dlType === 'all') {
        const campaignFilter: FilterOperation = {
          id: `campaign-${campaign.campaignId}`,
          type: 'filter',
          column: 'metadata',
          operation: 'json_equals',
          jsonField: 'campaignId',
          value: campaign.campaignId,
          order: 0,
        }
        await downloadCSV(
          agent?.id,
          [campaignFilter],
          visibleColumns,
          project?.id,
          (p) => setDlProgress(p),
        )
        setDlProgress(null)
        setDialogOpen(false)
      } else {
        const allRows: CallLog[] = []
        let page = 1
        const pageSize = 200
        while (true) {
          const res = await fetch(`/api/agents/${agent?.id}/call-logs/campaign/grouped`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId: campaign.campaignId, limit: pageSize, offset: (page - 1) * pageSize }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || 'Fetch failed')
          const batch: CallLog[] = json.data ?? []
          allRows.push(...batch)
          setDlProgress({ fetched: allRows.length, total: null, phase: 'fetching' })
          if (batch.length < pageSize) break
          page++
        }

        setDlProgress({ fetched: allRows.length, total: allRows.length, phase: 'processing' })
        const { basic, metadata: metaCols, transcription_metrics } = visibleColumns
        const csvData = allRows.map(r => flattenCallLogForCSV(r, basic, metaCols, transcription_metrics))
        const csv = Papa.unparse(csvData)
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `campaign_${campaign.campaignName.replace(/\s+/g, '_')}_last_calls.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        setDlProgress(null)
        setDialogOpen(false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDlRunning(false)
    }
  }, [dlRunning, dlType, campaign, agent?.id, project?.id, visibleColumns, setDialogOpen])

  const dataCols = useMemo(
    () => createTableColumns(visibleColumns, { availableTags, role }),
    [visibleColumns, availableTags, role]
  )

  const expandCol: ColumnDef<CallLog> = useMemo(() => ({
    id: '_expand',
    header: '',
    cell: ({ row }) => {
      const num = row.original.customer_number
      const expanded = expandedNumbers.has(num)
      const totalAttempts = countsMap[num]
      if (!totalAttempts || totalAttempts <= 1) return null
      return (
        <div
          onClick={(e) => { e.stopPropagation(); toggleExpand(num) }}
          className="flex items-center justify-center gap-1 w-full h-full min-h-[80px] cursor-pointer select-none group"
        >
          {expanded
            ? <ChevronDown className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
          }
          <span className={cn(
            'text-[10px] font-semibold leading-none transition-colors',
            expanded ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground group-hover:text-foreground'
          )}>
            ×{totalAttempts}
          </span>
        </div>
      )
    },
    size: 52,
    minSize: 52,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [expandedNumbers, toggleExpand, countsMap])

  const columns = useMemo(() => [expandCol, ...dataCols], [expandCol, dataCols])
  const colCount = columns.length

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const pageStart = (currentPage - 1) * CAMPAIGN_PAGE_SIZE + 1
  const pageEnd = (currentPage - 1) * CAMPAIGN_PAGE_SIZE + rows.length

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading campaign calls…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-500 text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Campaign context banner */}
      <div className="flex-none flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/30">
        <span className="text-sm font-medium">{campaign.campaignName}</span>
        <span className="text-muted-foreground text-sm">—</span>
        <span className="text-sm text-muted-foreground">campaign view</span>
        <Button
          variant="ghost" size="sm"
          className="h-6 w-6 p-0 ml-auto"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={cn('h-3 w-3', isRefetching && 'animate-spin')} />
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-[2px] z-30 overflow-hidden transition-opacity duration-200',
            (isFetchingNextPage || isRefetching) ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className="h-full bg-blue-500 dark:bg-blue-400 animate-[progress-slide_1.2s_ease-in-out_infinite]" />
        </div>

        <div
          className={cn(
            'absolute inset-0 overflow-auto transition-opacity duration-150',
            (isFetchingNextPage || isRefetching) && 'opacity-60 pointer-events-none'
          )}
        >
          <table className="w-full border-collapse border-spacing-0">
            <thead className="sticky h-12 -top-1 z-20 bg-background dark:bg-gray-900 shadow-sm">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="bg-muted/80 dark:bg-gray-800/80">
                  {hg.headers.map(h => (
                    <th
                      key={h.id}
                      className={cn(
                        "px-4 truncate py-1.5 text-left font-semibold border-b-2 border-gray-200 dark:border-gray-800 text-sm leading-tight",
                        h.id.startsWith('transcription-')
                          ? "text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-900/10"
                          : h.id.startsWith('metrics-')
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/10"
                            : "text-foreground dark:text-gray-100"
                      )}
                      style={{ minWidth: h.column.columnDef.minSize || 120, width: h.column.columnDef.size || 'auto' }}
                    >
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="h-[400px] text-center">
                    <div className="flex flex-col items-center justify-center space-y-4 py-12">
                      <div className="rounded-full bg-muted/50 p-6">
                        <Inbox className="w-12 h-12 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No calls found for this campaign</h3>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, rowIndex) => {
                  const isFlagged = Boolean(row.original.transcription_metrics?.flag?.text)
                  const isNavigating = navigatingCallId === row.original.id
                  const isExpanded = expandedNumbers.has(row.original.customer_number)

                  const expandedBg = isExpanded
                    ? (resolvedTheme === 'dark' ? '#1e3a5f' : '#dbeafe')
                    : undefined

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        style={isFlagged ? flaggedRowStyle : undefined}
                        className={cn(
                          'border-b border-border/50 h-20 transition-colors',
                          isNavigating && 'pointer-events-none',
                          'border-t border-t-border/40',
                          isExpanded && 'border-l-4 border-l-blue-500',
                          !isFlagged && !isExpanded && 'hover:bg-muted/30 dark:hover:bg-gray-800/50',
                          isFlagged && 'hover:brightness-95',
                        )}
                      >
                        {row.getVisibleCells().map((cell, cellIndex) => (
                          <td
                            key={cell.id}
                            onClick={cellIndex === 0 ? undefined : () => handleNavigate(row.original.id, row.original.agent_id)}
                            style={expandedBg ? { backgroundColor: expandedBg } : undefined}
                            className={cn(
                              'px-4 py-1 text-sm dark:text-gray-100 leading-tight h-20',
                              cellIndex > 0 && 'cursor-pointer border-l border-border/20',
                              rowIndex === 0 && 'border-t-0',
                              !expandedBg && cell.column.id.startsWith('transcription-') && 'dark:bg-purple-900/10',
                              !expandedBg && cell.column.id.startsWith('metrics-') && 'dark:bg-blue-900/10',
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>

                      {isExpanded && (
                        <ContactCallsRows
                          subRows={row.original.sub_rows ?? []}
                          dataCols={dataCols}
                          colCount={colCount}
                          onNavigate={handleNavigate}
                        />
                      )}
                      {isExpanded && rowIndex < rows.length - 1 && (
                        <tr>
                          <td colSpan={colCount} className="h-2 p-0" style={{ backgroundColor: resolvedTheme === 'dark' ? '#111827' : '#ffffff' }} />
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination bar */}
      <div className="flex-none flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-background/95 dark:bg-gray-900/95">
        <span className="text-sm text-muted-foreground min-w-[100px]">
          {rows.length > 0 ? `${pageStart}–${pageEnd}` : '—'}
        </span>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
            disabled={isFirstPage || isLoading} onClick={goToPrevPage}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium tabular-nums px-1">Page {currentPage}</span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
            disabled={isLastPage || isFetchingNextPage} onClick={goToNextPage}>
            {isFetchingNextPage
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <ChevronRight className="h-4 w-4" />
            }
          </Button>
        </div>

        <span className="text-xs text-muted-foreground min-w-[100px] text-right">
          {isLastPage ? `${rows.length} on this page` : `${rows.length} rows · more →`}
        </span>
      </div>

      {/* Download dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!dlRunning) setDialogOpen(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download Campaign CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <button
              onClick={() => setDlType('last')}
              className={cn(
                'w-full text-left rounded-lg border p-4 transition-colors',
                dlType === 'last'
                  ? 'border-primary bg-muted'
                  : 'border-border hover:bg-muted/40'
              )}
            >
              <div className="font-medium text-sm">Last calls only</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                One row per contact — their most recent call attempt
              </div>
            </button>

            <button
              onClick={() => setDlType('all')}
              className={cn(
                'w-full text-left rounded-lg border p-4 transition-colors',
                dlType === 'all'
                  ? 'border-primary bg-muted'
                  : 'border-border hover:bg-muted/40'
              )}
            >
              <div className="font-medium text-sm">All calls</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Every attempt for every contact in this campaign
              </div>
            </button>
          </div>

          {dlProgress && (
            <div className="text-xs text-muted-foreground px-1">
              {dlProgress.phase === 'fetching'
                ? `Fetching… ${dlProgress.fetched} rows`
                : 'Building CSV…'
              }
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={dlRunning}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={dlRunning} className="gap-1.5">
              {dlRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CampaignCallLogs
