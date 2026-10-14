"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useReactTable, getCoreRowModel, flexRender, type CellContext, type ColumnDef } from "@tanstack/react-table"
import {
  AlertCircle, ChevronLeft, ChevronRight, Download, Ellipsis, Keyboard, RefreshCw, Rows3, Rows4, Settings, X, History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { FilterOperation } from "@/components/CallFilter"
import FlagRulesDialog from "@/components/FlagRulesDialog"
import { useCallLogsData, PAGE_SIZE } from "@/hooks/useCallLogsData"
import { useCallLogsColumns, BASIC_COLUMNS, EXTRA_RESTRICTABLE_COLUMNS } from "@/hooks/useCallLogsColumns"
import { useMemberVisibility } from "@/hooks/useMemberVisibility"
import { useGlobalRole } from "@/hooks/useGlobalRole"
import { canShowOrgSection } from "@/types/visibility"
import { useCallLogsStore } from "@/stores/callLogsStore"
import { flattenCallLogForCSV, isViewerRole, triggerCSVFileDownload } from "@/utils/callLogsUtils"
import { AskPi, type FilterProposal } from "./AskPi"
import { useCallLogsViewMode } from "@/hooks/useCallLogsViewMode"
import type { CallLog } from "@/types/logs"
import { createTableColumns } from "../tableColumns"
import { FilterHeaderSkeleton, TableSkeleton, ReanalyzeDialogWrapper } from "../sub-components"
import { CampaignSelector, type Campaign } from "../CampaignSelector"
import CampaignCallLogs from "../CampaignCallLogs"
import DownloadDialog from "../DownloadDialog"
import DownloadSettingsDialog from "../DownloadSettingsDialog"
import {
  buildPageItems, buildSelectionColumn, buildCallAgainColumn, canShowDownloadButton, formatRowRangeLabel, type PageItem,
  shouldShowLoadingSkeleton, useAgentDownloadSettingsQuery, useColumnVisibilityHandlers,
  useOutboundPhoneNumbersQuery, useRowNavigation,
} from "../CallLogs"
import { FilterChips, FilterPanel } from "./FilterPanel"
import { ColumnsPicker, type ColumnGroup, type PickerColumn } from "./ColumnsPicker"
import { CallLogsTable } from "./CallLogsTable"
import { StatusCell } from "./StatusCell"
import { PrefetchTranscript, SplitView } from "./split/SplitView"
import { callDurationSeconds } from "./split/callData"
import { CallEventCell, CallIdCell, CustomerNumberCell, DurationCell, FlagCell, StartTimeCell, TagsCell } from "./cells"
import { V2_BTN, V2_ICON_BTN, V2_THEME } from "./theme"
import { keyboardIsBusy, pageKey } from "./keyboard"

interface CallLogsV2Props {
  project: any
  agent: any
  isLoading?: boolean
  dateRange?: { from: string; to: string }
  onAgentUpdated?: () => void
  openDownloadSettings?: boolean
}

const columnIdFor = (group: ColumnGroup, key: string) => {
  if (group === "basic") return key
  if (group === "transcription_metrics") return `transcription-${key}`
  return `${group}-${key}`
}

// True when focus is somewhere the user is typing, or a dialog/menu owns the keyboard.
const COLUMN_BANDS: Record<string, { min: number; max: number }> = {
  tags: { min: 140, max: 200 },
  flag: { min: 110, max: 180 },
}

type CallCell = (ctx: CellContext<CallLog, unknown>) => React.ReactNode

// The redesign's own renderers for the plain-value basic columns. Defined here,
// outside the component, so each render doesn't create new cell components.
const customerNumberCell: CallCell = ({ row }) => <CustomerNumberCell call={row.original} />
const callIdCell: CallCell = ({ row }) => <CallIdCell call={row.original} />
const statusCell: CallCell = ({ row }) => <StatusCell call={row.original} />
const durationCell: CallCell = ({ row }) => <DurationCell seconds={callDurationSeconds(row.original)} />
const billingDurationCell: CallCell = ({ row }) => <DurationCell seconds={row.original.billing_duration_seconds} />
const startTimeCell: CallCell = ({ row }) => <StartTimeCell call={row.original} />
const callEventCell: CallCell = ({ row }) => <CallEventCell call={row.original} />

interface V2CellOptions {
  availableTags: string[]
  role: string | null
  currentUserId: string | null
  currentUserEmail: string | null
  onUpdated: () => void
}

function v2CellRenderers({ availableTags, role, currentUserId, currentUserEmail, onUpdated }: V2CellOptions): Record<string, CallCell> {
  return {
    customer_number: customerNumberCell,
    call_id: callIdCell,
    call_ended_reason: statusCell,
    duration_seconds: durationCell,
    billing_duration_seconds: billingDurationCell,
    call_started_at: startTimeCell,
    wcall_event: callEventCell,
    tags: ({ row }) => <TagsCell call={row.original} availableTags={availableTags} role={role} onUpdated={onUpdated} />,
    flag: ({ row }) => (
      <FlagCell call={row.original} role={role} currentUserId={currentUserId} currentUserEmail={currentUserEmail} onUpdated={onUpdated} />
    ),
  }
}

function toV2Column(c: ColumnDef<CallLog>, v2Cell: Record<string, CallCell>): ColumnDef<CallLog> {
  const cell = v2Cell[c.id as string]
  // Size columns to their content like the mockup, instead of the legacy fixed minimums.
  if (!cell) return { ...c, minSize: 120 }
  // Tags and Flag hold editable pills: a fixed band, the overflow shown as "+N".
  const band = COLUMN_BANDS[c.id as string]
  return { ...c, cell, minSize: band?.min ?? (c.id === "customer_number" ? 180 : 90), size: undefined, ...(band ? { meta: { maxWidth: band.max } } : {}) }
}

// Same dialog and eligibility rules; only its trigger is shrunk to the
// mockup's small button so it doesn't set the height of every row.
function compactCallAgainColumn(legacyCallAgain: ColumnDef<CallLog>): ColumnDef<CallLog> {
  return {
    ...legacyCallAgain,
    cell: (ctx) => (
      <div className="[&>button]:h-6 [&>button]:rounded-md [&>button]:border-[var(--cl-border)] [&>button]:bg-[var(--cl-panel2)] [&>button]:px-2 [&>button]:text-[12.5px] [&>button]:text-[var(--cl-text2)] [&>button:hover]:bg-[var(--cl-hover)] [&>button:hover]:text-[var(--cl-text)]">
        {flexRender(legacyCallAgain.cell, ctx)}
      </div>
    ),
  }
}

// Calling a customer back from the logs is for owners/admins only.
function canCallAgain(role: string | null, agent: any, outboundPhoneNumbers: unknown[]): boolean {
  return (role === "owner" || role === "admin") && agent?.agent_type === "pype_agent" && outboundPhoneNumbers.length > 0
}

function findCall(calls: CallLog[], id: string | null): CallLog | null {
  return calls.find((c) => c.id === id) ?? null
}

// What Ask Pi's header says it's looking at.
function askPiContextLabel(openCallId: string | null, filterCount: number, totalCount: number | null | undefined, pageCount: number): string {
  if (openCallId) return `This call · …${openCallId.slice(-8)}`
  const calls = totalCount ?? pageCount
  if (filterCount) return `${calls} calls · ${filterCount} filter${filterCount > 1 ? "s" : ""}`
  return `${calls} calls · date range`
}

type MainView = "error" | "campaign" | "split" | "table"

function mainViewFor(error: unknown, selectedCampaign: Campaign | null, splitOpen: boolean): MainView {
  if (error) return "error"
  if (selectedCampaign) return "campaign"
  if (splitOpen) return "split"
  return "table"
}

// ── Keyboard ─────────────────────────────────────────────────────────────────
interface CallLogsKeyContext {
  root: HTMLDivElement | null
  selectedCampaign: Campaign | null
  pageLoading: boolean
  splitOpen: boolean
  calls: CallLog[]
  cursor: number
  openCallId: string | null
  goToNextPage: () => void
  goToPrevPage: () => void
  toggleRightPanel: () => void
  closeSplit: () => void
  setOpenCallId: (id: string | null) => void
  setCursor: React.Dispatch<React.SetStateAction<number>>
  openCall: (call: CallLog) => void
}

const isDownKey = (e: KeyboardEvent) => e.key === "ArrowDown" || e.key === "j"
const isUpKey = (e: KeyboardEvent) => e.key === "ArrowUp" || e.key === "k"

// With a call open: Esc/Backspace closes it, ↓/j and ↑/k move between calls.
function handleSplitKey(e: KeyboardEvent, k: CallLogsKeyContext) {
  const last = k.calls.length - 1
  // Read the open call from the URL itself, so a fast second keypress
  // can't act on the call from before the last re-render.
  const currentId = new URLSearchParams(globalThis.location.search).get("call") ?? k.openCallId
  const idx = k.calls.findIndex((c) => c.id === currentId)
  if (e.key === "Escape" || e.key === "Backspace") {
    e.preventDefault()
    k.closeSplit()
  } else if (isDownKey(e)) {
    e.preventDefault()
    k.setOpenCallId(k.calls[Math.min(last, Math.max(0, idx + 1))].id)
  } else if (isUpKey(e)) {
    e.preventDefault()
    k.setOpenCallId(k.calls[Math.max(0, idx - 1)].id)
  }
}

// On the table: ↓/j and ↑/k move the cursor, Enter opens the call under it.
function handleTableKey(e: KeyboardEvent, k: CallLogsKeyContext) {
  const last = k.calls.length - 1
  if (isDownKey(e)) {
    e.preventDefault()
    k.setCursor((c) => (c < 0 ? 0 : Math.min(last, c + 1)))
  } else if (isUpKey(e)) {
    e.preventDefault()
    k.setCursor((c) => (c < 0 ? 0 : Math.max(0, c - 1)))
  } else if (e.key === "Enter" && k.cursor >= 0 && k.calls[k.cursor]) {
    e.preventDefault()
    k.openCall(k.calls[k.cursor])
  }
}

function handleCallLogsKey(e: KeyboardEvent, k: CallLogsKeyContext) {
  // The Logs tab stays mounted while hidden; only react when it's on screen.
  if (!k.root?.offsetParent || k.selectedCampaign || keyboardIsBusy(e)) return
  if (k.pageLoading) {
    // Swallow navigation keys rather than letting them act on the outgoing page.
    if (pageKey(e) || ["ArrowUp", "ArrowDown", "Enter", "j", "k"].includes(e.key)) e.preventDefault()
    return
  }
  const page = pageKey(e)
  if (page) {
    e.preventDefault()
    if (page === "next") k.goToNextPage()
    else k.goToPrevPage()
    return
  }
  if (k.splitOpen && (e.metaKey || e.ctrlKey) && (e.key === "]" || e.code === "BracketRight")) {
    // Also stops the browser's own ⌘] (history forward) while a call is open.
    e.preventDefault()
    k.toggleRightPanel()
    return
  }
  if (e.metaKey || e.ctrlKey || e.altKey || k.calls.length === 0) return
  if (k.splitOpen) handleSplitKey(e, k)
  else handleTableKey(e, k)
}

const CallLogsV2: React.FC<CallLogsV2Props> = ({
  project, agent, isLoading: parentLoading, dateRange, onAgentUpdated, openDownloadSettings,
}) => {
  const router = useRouter()
  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress
  const rootRef = useRef<HTMLDivElement>(null)

  const {
    calls, currentPageCalls, currentPage, totalCount, totalPages, isFirstPage, isLastPage, hasNextPage,
    goToNextPage, goToPrevPage, goToPage, role, roleLoading, isLoading, isFetchingNextPage, isChangingPage, isRefetching,
    error, activeFilters, setActiveFilters, refetch, refetchCurrentPage,
  } = useCallLogsData(agent, userEmail, project?.id, dateRange, user?.id)
  // Moving between pages: the old page stays on screen until the new one arrives,
  // so everything that could act on it (pager, keys, rows) holds still meanwhile.
  const pageLoading = isChangingPage || isFetchingNextPage

  const { visibility } = useMemberVisibility(project?.id ?? undefined)
  const canReanalyze = canShowOrgSection(visibility, "reanalyze")
  // Flag rules expose the same kind of internal QA criteria as field extractor config — same gate.
  const canManageFlagRules = canShowOrgSection(visibility, "fieldExtractor")
  const { isSuperAdmin } = useGlobalRole()

  const [, setViewMode] = useCallLogsViewMode()
  const density = useCallLogsStore((s) => s.density)
  const setDensity = useCallLogsStore((s) => s.setDensity)
  // Column order is kept per agent, like the columns themselves.
  const columnOrder = useCallLogsStore((s) => s.columnOrderByAgent[agent?.id ?? ""] ?? s.columnOrder)
  const setColumnOrderForAgent = useCallLogsStore((s) => s.setColumnOrderForAgent)
  const setColumnOrder = useCallback((order: string[]) => setColumnOrderForAgent(agent?.id ?? "", order), [agent?.id, setColumnOrderForAgent])
  const distinctConfig = useCallLogsStore((s) => (agent?.id ? s.distinctConfigByAgent[agent.id] : undefined))
  const selectedCampaign = useCallLogsStore((s) => (agent?.id ? (s.selectedCampaignByAgent[agent.id] ?? null) : null))
  const setSelectedCampaignForAgent = useCallLogsStore((s) => s.setSelectedCampaignForAgent)
  const setSelectedCampaign = useCallback((c: Campaign | null) => {
    if (agent?.id) setSelectedCampaignForAgent(agent.id, c)
  }, [agent?.id, setSelectedCampaignForAgent])

  const { visibleColumns, setVisibleColumns, dynamicColumns, filteredBasicColumns } = useCallLogsColumns(agent, calls, role)
  const { handleColumnChange } = useColumnVisibilityHandlers(setVisibleColumns, dynamicColumns)

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    calls.forEach((call) => {
      const tags = call.transcription_metrics?.tags
      if (Array.isArray(tags)) tags.forEach((t: string) => tagSet.add(t))
    })
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b))
  }, [calls])

  // ── Columns ────────────────────────────────────────────────────────────────
  // Cells come from the same createTableColumns as the legacy table, so every
  // renderer (tag/flag editors, cost tooltip, QA, metrics) behaves identically.
  // The plain-value basic columns get the redesign's own renderers (cells.tsx);
  // tags and flags keep the same editors in their "quiet" variant.
  const baseColumns = useMemo(() => {
    const currentUserId = user?.id ?? null
    const currentUserEmail = userEmail ?? null
    const cols = createTableColumns(visibleColumns, {
      availableTags, onTagsUpdated: refetchCurrentPage, role, currentUserId, currentUserEmail,
    })
    const v2Cell = v2CellRenderers({ availableTags, role, currentUserId, currentUserEmail, onUpdated: refetchCurrentPage })
    return cols.map((c) => toV2Column(c, v2Cell))
  }, [visibleColumns, availableTags, refetchCurrentPage, role, user?.id, userEmail])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  useEffect(() => { setSelectedIds(new Set()) }, [currentPage, activeFilters])

  const { data: outboundPhoneNumbers = [] } = useOutboundPhoneNumbersQuery(project?.id)
  const canOfferCallAgain = canCallAgain(role, agent, outboundPhoneNumbers)

  const columns = useMemo(() => {
    const legacyCallAgain = agent?.id ? buildCallAgainColumn(canOfferCallAgain, project?.id, agent, outboundPhoneNumbers) : null
    const callAgain = legacyCallAgain && compactCallAgainColumn(legacyCallAgain)
    return [buildSelectionColumn(currentPageCalls, selectedIds, setSelectedIds), ...baseColumns, ...(callAgain ? [callAgain] : [])]
  }, [baseColumns, currentPageCalls, selectedIds, canOfferCallAgain, project?.id, agent, outboundPhoneNumbers])

  // Saved order first, then any visible column it doesn't know yet, in their natural order.
  // The selection checkbox is always first.
  const effectiveOrder = useMemo(() => {
    const ids = columns.map((c) => c.id as string).filter((id) => id !== "select")
    const known = columnOrder.filter((id) => ids.includes(id))
    return ["select", ...known, ...ids.filter((id) => !known.includes(id))]
  }, [columns, columnOrder])

  const table = useReactTable({
    data: currentPageCalls,
    columns,
    state: { columnOrder: effectiveOrder },
    getCoreRowModel: getCoreRowModel(),
  })

  const pickerColumns: PickerColumn[] = useMemo(() => {
    const group = (g: ColumnGroup, keys: readonly string[], label = (k: string) => k) =>
      keys.map((key) => ({ id: columnIdFor(g, key), key, group: g, label: label(key) }))
    return [
      ...filteredBasicColumns.map((c) => ({ id: c.key, key: c.key, group: "basic" as const, label: c.label })),
      ...group("metadata", dynamicColumns.metadata),
      ...group("transcription_metrics", dynamicColumns.transcription_metrics),
      ...group("metrics", dynamicColumns.metrics, (k) => k.replaceAll("_", " ").replaceAll(/\b\w/g, (l) => l.toUpperCase())),
    ]
  }, [filteredBasicColumns, dynamicColumns])

  const shownIds = effectiveOrder.filter((id) => pickerColumns.some((c) => c.id === id))

  const onToggleColumn = useCallback((col: PickerColumn, visible: boolean) => {
    handleColumnChange(col.group, col.key, visible)
    // A column turned on lands at the end of the current order.
    if (visible) setColumnOrder([...shownIds.filter((id) => id !== col.id), col.id])
  }, [handleColumnChange, setColumnOrder, shownIds])

  const resetColumns = useCallback(() => {
    setColumnOrder([])
    setVisibleColumns({
      basic: filteredBasicColumns.map((c) => c.key),
      metadata: dynamicColumns.metadata,
      transcription_metrics: dynamicColumns.transcription_metrics,
      metrics: dynamicColumns.metrics,
    })
  }, [setColumnOrder, setVisibleColumns, filteredBasicColumns, dynamicColumns])

  // A whole section at once: shown ones join the end of the order, hidden ones leave it.
  const setColumns = useCallback((cols: PickerColumn[], visible: boolean) => {
    const ids = new Set(cols.map((c) => c.id))
    setVisibleColumns((prev) => {
      const next = { ...prev }
      for (const c of cols) {
        const has = next[c.group].includes(c.key)
        if (visible && !has) next[c.group] = [...next[c.group], c.key]
        if (!visible && has) next[c.group] = next[c.group].filter((k) => k !== c.key)
      }
      return next
    })
    setColumnOrder(visible
      ? [...shownIds, ...cols.map((c) => c.id).filter((id) => !shownIds.includes(id))]
      : shownIds.filter((id) => !ids.has(id)))
  }, [setVisibleColumns, setColumnOrder, shownIds])

  // Like reset, but keeps the user's column order.
  const showAllColumns = useCallback(() => {
    setVisibleColumns({
      basic: filteredBasicColumns.map((c) => c.key),
      metadata: dynamicColumns.metadata,
      transcription_metrics: dynamicColumns.transcription_metrics,
      metrics: dynamicColumns.metrics,
    })
  }, [setVisibleColumns, filteredBasicColumns, dynamicColumns])

  // ── Selection actions (same output as the legacy page) ─────────────────────
  const selectedCalls = useMemo(() => currentPageCalls.filter((c) => selectedIds.has(c.id)), [currentPageCalls, selectedIds])
  const [copyFeedback, setCopyFeedback] = useState(false)
  const buildSelectedRecords = useCallback(
    () => selectedCalls.map((row) => flattenCallLogForCSV(row, visibleColumns.basic, visibleColumns.metadata, visibleColumns.transcription_metrics)),
    [selectedCalls, visibleColumns]
  )
  const copySelected = useCallback(async () => {
    await navigator.clipboard.writeText(JSON.stringify(buildSelectedRecords(), null, 2))
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 2000)
  }, [buildSelectedRecords])

  // ── Downloads ──────────────────────────────────────────────────────────────
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [campaignDownloadOpen, setCampaignDownloadOpen] = useState(false)
  const [downloadSettingsOpen, setDownloadSettingsOpen] = useState(!!openDownloadSettings)
  useEffect(() => { if (openDownloadSettings) setDownloadSettingsOpen(true) }, [openDownloadSettings])
  const { data: downloadSettingsData, refetch: refetchDownloadSettings } = useAgentDownloadSettingsQuery(agent?.id)
  const canDownload = canShowDownloadButton(downloadSettingsData?.canDownload, isSuperAdmin)

  // ── Row opening + keyboard cursor ─────────────────────────────────────────
  const { navigatingCallId, scrollContainerRef } =
    useRowNavigation(agent?.id, project?.id, router, isLoading, currentPageCalls)

  // ── Split view: the open call lives in the URL (?call=<id>), so refresh, Back
  // and shared links all land on the same call. ──
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const openCallId = searchParams.get("call")
  // The browser history API rather than router.replace: Next keeps
  // useSearchParams in sync with it, and it skips the server round trip a router
  // navigation makes — which made opening, switching and closing a call lag ~1s.
  // Opening from the table adds a history entry (so Back returns to the table);
  // moving between calls or closing just replaces it.
  const setOpenCallId = useCallback((id: string | null, mode: "push" | "replace" = "replace") => {
    const params = new URLSearchParams(searchParams.toString())
    if (id) params.set("call", id)
    else params.delete("call")
    const query = params.toString()
    const url = query ? `${pathname}?${query}` : pathname
    if (mode === "push") globalThis.history.pushState(null, "", url)
    else globalThis.history.replaceState(null, "", url)
  }, [pathname, searchParams])
  const splitOpen = !!openCallId && !selectedCampaign
  const openedCall = splitOpen ? findCall(currentPageCalls, openCallId) : null
  // Whether a call has been open on this visit. Only then may the page move the
  // split to another call by itself; a link's call that isn't in the list shows
  // "not found" instead of quietly opening someone else's call.
  const [browsingCalls, setBrowsingCalls] = useState(false)
  useEffect(() => { if (openedCall) setBrowsingCalls(true) }, [openedCall])
  const openCallMissing = splitOpen && !isLoading && !openedCall && (!browsingCalls || currentPageCalls.length === 0)

  // From the table it's a new history entry; from the split list it's a switch.
  const openCall = useCallback((call: CallLog) => setOpenCallId(call.id, openCallId ? "replace" : "push"), [setOpenCallId, openCallId])

  const [cursor, setCursor] = useState(-1)

  // A row the pointer rests on for a moment is loaded in the background; a quick
  // sweep across the table doesn't fire a request per row.
  const [prefetchId, setPrefetchId] = useState<string | null>(null)
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefetchSoon = useCallback((call: CallLog) => {
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current)
    prefetchTimer.current = setTimeout(() => setPrefetchId(call.id), 120)
  }, [])
  useEffect(() => () => { if (prefetchTimer.current) clearTimeout(prefetchTimer.current) }, [])
  // The keyboard cursor prefetches the same way; holding ↓ only loads where it stops.
  const cursorCall = currentPageCalls[cursor]
  useEffect(() => { if (cursorCall) prefetchSoon(cursorCall) }, [cursorCall, prefetchSoon])
  // A new page or result set starts the cursor fresh (on the first row if it was in use).
  useEffect(() => { setCursor((c) => (c >= 0 ? 0 : -1)) }, [currentPage, activeFilters])

  // Paging with the split open moves to the new page's first call; an open call
  // that isn't in the loaded page (e.g. after a filter change) does the same.
  useEffect(() => {
    if (!splitOpen || !browsingCalls || isLoading || currentPageCalls.length === 0 || openedCall) return
    setOpenCallId(currentPageCalls[0].id)
  }, [splitOpen, browsingCalls, isLoading, currentPageCalls, openedCall, setOpenCallId])

  const closeSplit = useCallback(() => {
    // Back on the table, the keyboard cursor sits on the call that was open.
    const idx = currentPageCalls.findIndex((c) => c.id === openCallId)
    if (idx >= 0) setCursor(idx)
    setOpenCallId(null)
  }, [currentPageCalls, openCallId, setOpenCallId])

  const toggleRightPanel = useCallback(() => {
    const { rightPanelCollapsed, setRightPanelCollapsed } = useCallLogsStore.getState()
    setRightPanelCollapsed(!rightPanelCollapsed)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleCallLogsKey(e, {
      root: rootRef.current, selectedCampaign, pageLoading, splitOpen, calls: currentPageCalls, cursor, openCallId,
      goToNextPage, goToPrevPage, toggleRightPanel, closeSplit, setOpenCallId, setCursor, openCall,
    })
    globalThis.addEventListener("keydown", onKey)
    return () => globalThis.removeEventListener("keydown", onKey)
  }, [currentPageCalls, cursor, openCall, goToNextPage, goToPrevPage, selectedCampaign, splitOpen, openCallId, closeSplit, setOpenCallId, toggleRightPanel, pageLoading])

  // Keep the cursor row in view vertically only — scrollIntoView would also jump
  // the table sideways, losing whatever column the user had scrolled to.
  useEffect(() => {
    const container = scrollContainerRef.current
    const row = container?.querySelector<HTMLElement>(`[data-row-index="${cursor}"]`)
    if (!container || !row || cursor < 0) return
    const headerHeight = container.querySelector("thead")?.getBoundingClientRect().height ?? 0
    const top = row.offsetTop - headerHeight
    const bottom = row.offsetTop + row.offsetHeight - container.clientHeight
    if (container.scrollTop > top) container.scrollTop = top
    else if (container.scrollTop < bottom) container.scrollTop = bottom
  }, [cursor, scrollContainerRef])

  const clearFilters = useCallback(() => setActiveFilters([]), [setActiveFilters])
  const applyFilters = useCallback((ops: FilterOperation[]) => setActiveFilters(ops), [setActiveFilters])
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)

  // Ask Pi's Apply button: its filters become ordinary filter-panel filters (chips you can remove).
  const applyPiFilters = useCallback((proposal: FilterProposal) => {
    const base = proposal.mode === "replace" ? [] : activeFilters
    const added: FilterOperation[] = proposal.filters.map((f, i) => ({
      id: `pi-${Date.now()}-${i}`,
      type: "filter",
      column: f.column,
      operation: f.operation,
      value: f.value,
      ...(f.jsonField ? { jsonField: f.jsonField } : {}),
      order: base.length + i,
    }))
    setActiveFilters([...base, ...added])
  }, [activeFilters, setActiveFilters])

  // A call Pi cites: open it here when it's on this page, otherwise its full trace in a new tab.
  const openCallFromPi = useCallback((id: string) => {
    const onPage = currentPageCalls.find((c) => c.id === id)
    if (onPage) openCall(onPage)
    else if (project?.id && agent?.id) globalThis.open(`/${project.id}/agents/${agent.id}/observability?session_id=${id}`, "_blank", "noopener")
  }, [currentPageCalls, openCall, project?.id, agent?.id])

  const pageItems = buildPageItems(currentPage, currentPage, hasNextPage, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = (currentPage - 1) * PAGE_SIZE + currentPageCalls.length
  const rangeLabel = formatRowRangeLabel(currentPageCalls.length, totalCount, pageStart, pageEnd)

  // ── Loading / error ────────────────────────────────────────────────────────
  if (shouldShowLoadingSkeleton(parentLoading, roleLoading, agent, project, isLoading, currentPageCalls.length)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <FilterHeaderSkeleton />
        <TableSkeleton />
      </div>
    )
  }

  const pager: PagerProps = {
    isFirstPage, isLastPage, isLoading, pageLoading, goToPrevPage, goToNextPage,
  }

  // ── Main area: one of these, picked by mainViewFor below ──
  // A failed load keeps the toolbar, filter chips and Ask Pi on screen, so a
  // filter that made the query fail can be removed right here.
  const mainViews: Record<MainView, React.ReactNode> = {
    error: <LoadErrorState error={error} hasFilters={activeFilters.length > 0} onClearFilters={clearFilters} />,
    // Campaign view replaces the table, exactly as on the legacy page
    campaign: selectedCampaign && (
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
    ),
    split: openedCall ? (
      <SplitView
        call={openedCall}
        calls={currentPageCalls}
        agent={agent}
        projectId={project?.id}
        role={role}
        currentUserId={user?.id ?? null}
        currentUserEmail={userEmail ?? null}
        availableTags={availableTags}
        onUpdated={refetchCurrentPage}
        canOfferCallAgain={canOfferCallAgain}
        outboundPhoneNumbers={outboundPhoneNumbers}
        onOpen={openCall}
        onClose={closeSplit}
        listLoading={pageLoading}
        listFooter={<SplitListFooter {...pager} rangeLabel={rangeLabel} currentPage={currentPage} />}
      />
    ) : (
      <SplitPlaceholder
        missing={openCallMissing}
        callId={openCallId ?? ""}
        traceHref={project?.id ? `/${project.id}/agents/${agent.id}/observability?session_id=${encodeURIComponent(openCallId ?? "")}` : null}
        onBack={closeSplit}
      />
    ),
    table: (
      <>
        <CallLogsTable
          table={table}
          density={density}
          role={role}
          isLoading={isLoading}
          isBusy={pageLoading || isRefetching}
          pageLoading={pageLoading}
          hasFilters={activeFilters.length > 0}
          onClearFilters={clearFilters}
          cursorIndex={cursor}
          selectedCallId={null}
          navigatingCallId={navigatingCallId}
          onOpen={openCall}
          onHover={prefetchSoon}
          scrollContainerRef={scrollContainerRef}
        />
        {/* Start loading the call under the pointer or keyboard cursor, so it opens ready. */}
        {prefetchId && <PrefetchTranscript key={prefetchId} callId={prefetchId} agentId={agent.id} />}
        <TablePager {...pager} rangeLabel={rangeLabel} currentPage={currentPage} pageItems={pageItems} goToPage={goToPage} />
      </>
    ),
  }

  return (
    <div ref={rootRef} className={cn("flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--cl-bg)] text-[14px] text-[var(--cl-text)]", V2_THEME)}>
      {/* ── Toolbar ── */}
      <div className="flex flex-none flex-wrap items-center gap-2 border-b border-[var(--cl-border)] bg-[var(--cl-panel)] px-4 py-2.5">
        <FilterPanel
          activeFilters={activeFilters}
          distinctConfig={distinctConfig}
          onApply={applyFilters}
          metadataFields={dynamicColumns.metadata}
          transcriptionFields={dynamicColumns.transcription_metrics}
          role={role}
          open={filterPanelOpen}
          onOpenChange={setFilterPanelOpen}
        />
        {project?.id && (
          <CampaignSelector projectId={project.id} agentId={agent?.id ?? ""} selectedCampaign={selectedCampaign} onSelect={setSelectedCampaign} />
        )}

        {selectedIds.size > 0 && (
          <SelectionBar
            count={selectedIds.size}
            copyFeedback={copyFeedback}
            onCopy={copySelected}
            onExportCsv={() => triggerCSVFileDownload(buildSelectedRecords())}
            onClear={() => setSelectedIds(new Set())}
          />
        )}

        <div className="flex-1" />

        <button
          type="button" className={V2_ICON_BTN} aria-label="Refresh call logs" title="Refresh"
          onClick={() => {
            // a failed refresh shows up as the page's error state
            if (!isRefetching) refetch().catch(() => {})
          }}
          disabled={isLoading || isRefetching || isFetchingNextPage}
        >
          <RefreshCw className={cn("h-4 w-4", (isLoading || isRefetching) && "animate-spin")} />
        </button>

        {!splitOpen && (
          <ColumnsPicker
            disabledReason={selectedCampaign ? "Columns can't be changed while a campaign is selected" : undefined}
            columns={pickerColumns}
            shownIds={shownIds}
            onToggle={onToggleColumn}
            onReorder={setColumnOrder}
            onReset={resetColumns}
            onShowAll={showAllColumns}
            onSetColumns={setColumns}
          />
        )}

        {!selectedCampaign && !splitOpen && <DensityToggle density={density} onChange={setDensity} />}

        {canDownload && (
          <button
            type="button" className={V2_BTN}
            onClick={() => (selectedCampaign ? setCampaignDownloadOpen(true) : setDownloadDialogOpen(true))}
            disabled={!selectedCampaign && (isLoading || !agent?.id)}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        )}

        <MoreMenu>
          <MoreMenuItems
            projectId={project?.id}
            agent={agent}
            canReanalyze={canReanalyze}
            canManageFlagRules={canManageFlagRules}
            isSuperAdmin={isSuperAdmin}
            metadataKeys={dynamicColumns.metadata}
            metricKeys={dynamicColumns.metrics}
            onAgentUpdated={onAgentUpdated}
            onOpenDownloadSettings={() => setDownloadSettingsOpen(true)}
            onSwitchToClassic={() => setViewMode("legacy")}
          />
        </MoreMenu>
      </div>

      {/* Applied filters get their own slim row, so adding filters never pushes the toolbar onto more lines. */}
      <FilterChips activeFilters={activeFilters} onChange={applyFilters} onEdit={() => setFilterPanelOpen(true)} />

      {mainViews[mainViewFor(error, selectedCampaign, splitOpen)]}

      <DownloadDialogs
        agentId={agent?.id}
        projectId={project?.id}
        isSuperAdmin={isSuperAdmin}
        downloadDialogOpen={downloadDialogOpen}
        onDownloadDialogOpenChange={setDownloadDialogOpen}
        downloadSettingsOpen={downloadSettingsOpen}
        onDownloadSettingsOpenChange={setDownloadSettingsOpen}
        activeFilters={activeFilters}
        basicColumns={filteredBasicColumns}
        metadataColumns={dynamicColumns.metadata}
        transcriptionColumns={dynamicColumns.transcription_metrics}
        downloadSettingsData={downloadSettingsData}
        dateRange={dateRange}
        onSettingsSaved={() => refetchDownloadSettings()}
      />

      {/* Viewers don't get Ask Pi (the server refuses them too). */}
      {project?.id && agent?.id && role && !isViewerRole(role) && (
        <AskPi
          projectId={project.id}
          agentId={agent.id}
          openCallId={openCallId}
          filters={activeFilters}
          dateRange={dateRange}
          contextLabel={askPiContextLabel(openCallId, activeFilters.length, totalCount, currentPageCalls.length)}
          onApplyFilters={applyPiFilters}
          onOpenCall={openCallFromPi}
        />
      )}
    </div>
  )
}

function LoadErrorState({ error, hasFilters, onClearFilters }: Readonly<{ error: string | null | undefined; hasFilters: boolean; onClearFilters: () => void }>) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-md space-y-3 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-[var(--cl-red)]" />
        <h3 className="text-[16px] font-semibold">Couldn&apos;t load calls</h3>
        <p className="text-[13.5px] text-[var(--cl-text3)]">{error}</p>
        {hasFilters && /timeout|timed out|took too long|57014/i.test(error ?? "") && (
          <p className="text-[13.5px] text-[var(--cl-text3)]">These filters took too long to run. Try a shorter Period, or remove a filter.</p>
        )}
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>Clear filters and retry</Button>
        )}
      </div>
    </div>
  )
}

function SelectionBar({ count, copyFeedback, onCopy, onExportCsv, onClear }: Readonly<{
  count: number
  copyFeedback: boolean
  onCopy: () => void
  onExportCsv: () => void
  onClear: () => void
}>) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--cl-accent-line)] bg-[var(--cl-accent-soft)] pl-3 pr-1 text-[13px]">
      <span className="whitespace-nowrap font-medium text-[var(--cl-accent-text)]">{count} selected</span>
      <span className="mx-1 h-4 w-px bg-[var(--cl-accent-line)]" />
      <button type="button" className="h-6 rounded-md px-2 text-[var(--cl-text2)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]" onClick={onCopy}>
        {copyFeedback ? "Copied!" : "Copy JSON"}
      </button>
      <button type="button" className="h-6 rounded-md px-2 text-[var(--cl-text2)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]" onClick={onExportCsv}>
        Export CSV
      </button>
      <button type="button" className="grid h-6 w-6 place-items-center rounded-md text-[var(--cl-text3)] hover:bg-[var(--cl-hover)]" aria-label="Clear selection" onClick={onClear}>
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

type Density = "comfortable" | "compact"

function DensityToggle({ density, onChange }: Readonly<{ density: Density; onChange: (density: Density) => void }>) {
  return (
    <div role="radiogroup" aria-label="Row density" className="flex h-8 items-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel2)] p-0.5">
      {([["comfortable", Rows3, "Comfortable rows"], ["compact", Rows4, "Compact rows"]] as const).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={density === value}
          aria-label={label}
          title={label}
          onClick={() => onChange(value)}
          className={cn(
            "grid h-full w-7 place-items-center rounded-md text-[var(--cl-text3)] hover:text-[var(--cl-text)]",
            density === value && "bg-[var(--cl-raised)] text-[var(--cl-text)] shadow-[0_0_0_1px_var(--cl-border2)]"
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

function MoreMenuItems({
  projectId, agent, canReanalyze, canManageFlagRules, isSuperAdmin, metadataKeys, metricKeys, onAgentUpdated, onOpenDownloadSettings, onSwitchToClassic,
}: Readonly<{
  projectId: string | undefined
  agent: any
  canReanalyze: boolean
  canManageFlagRules: boolean
  isSuperAdmin: boolean
  metadataKeys: string[]
  metricKeys: string[]
  onAgentUpdated?: () => void
  onOpenDownloadSettings: () => void
  onSwitchToClassic: () => void
}>) {
  return (
    <>
      {canReanalyze && <ReanalyzeDialogWrapper projectId={projectId} agentId={agent?.id} />}
      {canManageFlagRules && agent?.id && (
        <FlagRulesDialog
          agentId={agent.id}
          fieldExtractorPrompt={agent?.field_extractor_prompt}
          initialFlagRules={agent?.flag_rules}
          metadataKeys={metadataKeys}
          metricKeys={metricKeys}
          onSaved={onAgentUpdated}
        />
      )}
      {isSuperAdmin && agent?.id && (
        <Button variant="outline" size="sm" className="justify-start" onClick={onOpenDownloadSettings}>
          <Settings className="mr-2 h-4 w-4" />
          Download settings
        </Button>
      )}
      <Button variant="ghost" size="sm" className="justify-start text-[var(--cl-text2)]" onClick={onSwitchToClassic}>
        <History className="mr-2 h-4 w-4" />
        Switch to classic view
      </Button>
    </>
  )
}

function DownloadDialogs({
  agentId, projectId, isSuperAdmin, downloadDialogOpen, onDownloadDialogOpenChange, downloadSettingsOpen, onDownloadSettingsOpenChange,
  activeFilters, basicColumns, metadataColumns, transcriptionColumns, downloadSettingsData, dateRange, onSettingsSaved,
}: Readonly<{
  agentId: string | undefined
  projectId: string | undefined
  isSuperAdmin: boolean
  downloadDialogOpen: boolean
  onDownloadDialogOpenChange: (open: boolean) => void
  downloadSettingsOpen: boolean
  onDownloadSettingsOpenChange: (open: boolean) => void
  activeFilters: FilterOperation[]
  basicColumns: React.ComponentProps<typeof DownloadDialog>["basicColumns"]
  metadataColumns: string[]
  transcriptionColumns: string[]
  downloadSettingsData: ReturnType<typeof useAgentDownloadSettingsQuery>["data"]
  dateRange?: { from: string; to: string }
  onSettingsSaved: () => void
}>) {
  if (!agentId) return null
  return (
    <>
      <DownloadDialog
        open={downloadDialogOpen}
        onOpenChange={onDownloadDialogOpenChange}
        agentId={agentId}
        projectId={projectId}
        activeFilters={activeFilters}
        basicColumns={basicColumns}
        metadataColumns={metadataColumns}
        transcriptionColumns={transcriptionColumns}
        hiddenColumns={downloadSettingsData?.hiddenDownloadColumns ?? downloadSettingsData?.hiddenColumns ?? []}
        initialDateRange={dateRange}
      />
      {isSuperAdmin && (
        <DownloadSettingsDialog
          open={downloadSettingsOpen}
          onOpenChange={onDownloadSettingsOpenChange}
          agentId={agentId}
          allColumns={[...BASIC_COLUMNS, ...EXTRA_RESTRICTABLE_COLUMNS].map((c) => ({ key: c.key, label: c.label }))}
          initialEnabled={downloadSettingsData?.settings?.enabled ?? true}
          initialSuperadminOnlyColumns={downloadSettingsData?.settings?.superadmin_only_columns ?? []}
          onSaved={onSettingsSaved}
        />
      )}
    </>
  )
}

interface PagerProps {
  isFirstPage: boolean
  isLastPage: boolean
  isLoading: boolean
  pageLoading: boolean
  goToPrevPage: () => void
  goToNextPage: () => void
}

function PrevPageButton({ isFirstPage, isLoading, pageLoading, goToPrevPage }: Readonly<PagerProps>) {
  return (
    <button type="button" className={PAGE_BTN} disabled={isFirstPage || isLoading || pageLoading} onClick={goToPrevPage} aria-label="Previous page" title="Previous page (⌘<)">
      <ChevronLeft className="h-4 w-4" />
    </button>
  )
}

function NextPageButton({ isLastPage, pageLoading, goToNextPage }: Readonly<PagerProps>) {
  return (
    <button type="button" className={PAGE_BTN} disabled={isLastPage || pageLoading} onClick={goToNextPage} aria-label="Next page" title="Next page (⌘>)">
      {pageLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  )
}

// The pager under the call list beside an open call.
const CALL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** While the open call loads, or — when the link's call isn't in the list — a "not found" note instead of opening a different call. */
function SplitPlaceholder({ missing, callId, traceHref, onBack }: Readonly<{ missing: boolean; callId: string; traceHref: string | null; onBack: () => void }>) {
  if (!missing) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--cl-text3)]">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Opening call…
      </div>
    )
  }
  const valid = CALL_ID_PATTERN.test(callId)
  return (
    <div role="alert" className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-[var(--cl-text3)]" />
        <h2 className="text-[15px] font-semibold">{valid ? "Call not found in this list" : "This link's call ID isn't valid"}</h2>
        <p className="mt-1.5 text-[13.5px] text-[var(--cl-text2)]">
          {valid
            ? "It may have been deleted, or it's outside the current date range, filters or page."
            : "Check that the whole link was copied. The call ID looks cut short or has extra characters."}
        </p>
        <code className="mt-3 inline-block max-w-full break-all rounded-md border border-[var(--cl-border)] bg-[var(--cl-panel2)] px-2 py-1 font-mono text-[12px] text-[var(--cl-text2)]">
          {callId}
        </code>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={onBack} className={V2_BTN}>
            <ChevronLeft className="h-4 w-4" /> Back to calls
          </button>
          {valid && traceHref && (
            <a href={traceHref} className={V2_BTN}>
              Open its trace
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function SplitListFooter(props: Readonly<PagerProps & { rangeLabel: React.ReactNode; currentPage: number }>) {
  return (
    <div className="flex h-[52px] flex-none items-center justify-between border-t border-[var(--cl-border)] px-3 text-[13px] text-[var(--cl-text3)]">
      <span>{props.rangeLabel}</span>
      <div className="flex items-center gap-[3px]">
        <PrevPageButton {...props} />
        <span className="px-1 tabular-nums text-[var(--cl-text2)]">{props.currentPage}</span>
        <NextPageButton {...props} />
      </div>
    </div>
  )
}

// The pager under the table: numbered pages, with gaps and "load more".
function TablePager(props: Readonly<PagerProps & {
  rangeLabel: React.ReactNode
  currentPage: number
  pageItems: PageItem[]
  goToPage: (page: number) => void
}>) {
  const { rangeLabel, currentPage, pageItems, goToPage, isLoading, pageLoading, goToNextPage } = props
  return (
    <div className="flex h-[52px] flex-none items-center justify-between border-t border-[var(--cl-border)] bg-[var(--cl-panel)] px-3 text-[13px] text-[var(--cl-text3)]">
      <span className="min-w-[120px]">
        {rangeLabel}
      </span>
      <div className="flex items-center gap-[3px]">
        <PrevPageButton {...props} />
        {pageItems.map((item) => {
          if (typeof item === "number") {
            const on = item === currentPage
            return (
              <button
                key={item} type="button" aria-label={`Page ${item}`} aria-current={on ? "page" : undefined}
                disabled={isLoading || pageLoading} onClick={() => goToPage(item)}
                className={cn(PAGE_BTN, on && "pointer-events-none bg-[var(--cl-raised)] text-[var(--cl-text)] shadow-[0_0_0_1px_var(--cl-border2)]")}
              >
                {item}
              </button>
            )
          }
          if (item === "load-more") {
            return (
              <button key="load-more" type="button" className={PAGE_BTN} disabled={pageLoading} onClick={goToNextPage} aria-label="Load more pages">…</button>
            )
          }
          return <span key={item} className="px-1 select-none">…</span>
        })}
        <NextPageButton {...props} />
      </div>
      <div className="flex min-w-[120px] justify-end">
        <ShortcutsHint />
      </div>
    </div>
  )
}

const PAGE_BTN =
  "grid h-[26px] min-w-[26px] place-items-center rounded-md px-1 text-[13px] text-[var(--cl-text2)] hover:bg-[var(--cl-hover)] disabled:pointer-events-none disabled:opacity-35"

// A plain always-mounted menu rather than a Popover: Re-analyze and Flag rules
// render their own Dialogs as children of their trigger buttons, so the menu
// must stay mounted (just hidden) for those dialogs to survive it closing.
function MoreMenu({ children }: Readonly<{ children: React.ReactNode }>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      // Clicks inside a dialog opened from the menu don't count as "outside".
      if (ref.current?.contains(target) || (target as HTMLElement).closest?.('[role="dialog"]')) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" className={V2_ICON_BTN} aria-label="More actions" onClick={() => setOpen((o) => !o)}>
        <Ellipsis className="h-[18px] w-[18px]" />
      </button>
      <div
        className={cn(
          "absolute right-0 top-10 z-50 flex w-56 flex-col rounded-xl border border-[var(--cl-border2)] bg-[var(--cl-raised)] p-[5px] shadow-[0_16px_40px_rgba(0,0,0,.35)]",
          // Every item reads as a plain menu row, including the Re-analyze / Flag rules
          // triggers, which bring their own outlined button styling.
          "[&>button]:h-auto [&>button]:w-full [&>button]:justify-start [&>button]:gap-2.5 [&>button]:rounded-md [&>button]:border-0 [&>button]:bg-transparent [&>button]:px-2.5 [&>button]:py-2 [&>button]:text-[13.5px] [&>button]:font-normal [&>button]:text-[var(--cl-text2)] [&>button]:shadow-none",
          "[&>button:hover]:bg-[var(--cl-hover)] [&>button:hover]:text-[var(--cl-text)] [&>button_svg]:mr-0 [&>button_svg]:h-4 [&>button_svg]:w-4",
          // the outline variant adds its own dark-mode tint, which needs a dark: override to beat
          "dark:[&>button]:bg-transparent dark:[&>button:hover]:bg-[var(--cl-hover)]",
          !open && "hidden"
        )}
      >
        {children}
      </div>
    </div>
  )
}

function ShortcutsHint() {
  const rows: Array<[string, string[]]> = [
    ["Move between rows", ["↑", "↓"]],
    ["Open call", ["↵"]],
    ["Next / previous page", ["⌘ >", "⌘ <"]],
    ["Next / previous call (open)", ["J", "K"]],
    ["Back to table", ["Esc"]],
    ["Show / hide call data", ["⌘ ]"]],
    ["Play / pause recording", ["Space"]],
    ["Back / forward 5s", ["←", "→"]],
  ]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Keyboard shortcuts" className="grid h-7 w-7 place-items-center rounded-md text-[var(--cl-text3)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]">
          <Keyboard className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="w-72 p-3">
        <p className="mb-2 text-xs font-semibold">Keyboard shortcuts</p>
        {rows.map(([label, keys]) => (
          <div key={label} className="flex items-center justify-between py-0.5 text-xs">
            <span className="opacity-80">{label}</span>
            <span className="flex gap-1">
              {keys.map((k) => (
                <kbd key={k} className="rounded border border-current/20 px-1 font-mono text-[10px]">{k}</kbd>
              ))}
            </span>
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

export default CallLogsV2
