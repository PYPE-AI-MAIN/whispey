"use client"

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Filter, Plus, Star, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import {
  COLUMNS, OPERATIONS, FILTER_VALUE_TO_BASIC_KEY, FilterRow, buildRows, rowToOperation,
  type FilterOperation, type RowState, type DistinctConfig,
} from "@/components/CallFilter"
import { isColumnVisibleForRole } from "@/utils/callLogsUtils"
import { useCallLogsStore, type PinnedFilterField } from "@/stores/callLogsStore"
import { cn } from "@/lib/utils"
import { V2_BTN, V2_THEME } from "./theme"

const JSONB_COLUMNS = new Set(["metadata", "transcription_metrics"])

// Same role gate the legacy CallFilter applies, so both views offer the same columns.
function columnsForRole(role: string | null) {
  if (role == null) return COLUMNS
  return COLUMNS.filter((c) => {
    const key = FILTER_VALUE_TO_BASIC_KEY[c.value]
    return key === undefined || isColumnVisibleForRole(key, role)
  })
}

const columnLabel = (value: string) => COLUMNS.find((c) => c.value === value)?.label ?? value

function operationLabel(value: string) {
  for (const ops of Object.values(OPERATIONS)) {
    const found = ops.find((o) => o.value === value)
    if (found) return found.label
  }
  return value
}

const pinKey = (p: { column: string; jsonField?: string }) => `${p.column}|${p.jsonField ?? ""}`

// The operator a Quick add pin starts with when it didn't save one — the most
// common choice for that column type, so a pinned field is usually one value away
// from a complete rule.
function defaultOperationFor(column: string) {
  if (JSONB_COLUMNS.has(column)) return "json_equals"
  if (column === "tags") return "contains"
  if (column === "flag") return "exists"
  return "equals"
}

interface FilterPanelProps {
  activeFilters: FilterOperation[]
  distinctConfig?: DistinctConfig
  onApply: (operations: FilterOperation[]) => void
  metadataFields: string[]
  transcriptionFields: string[]
  role: string | null
  /** Lets the page open the panel, e.g. from a filter chip. Uncontrolled when omitted. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const replaceRow = (rows: RowState[], id: string, updated: RowState) => rows.map((r) => (r.id === id ? updated : r))
const withoutRow = (rows: RowState[], id: string) => rows.filter((r) => r.id !== id)

// The footer's note on how many of the rows are ready to apply.
function readyLabel(completeCount: number, rowCount: number): string {
  if (completeCount > 0) return `${completeCount} ready`
  return rowCount > 0 ? "Complete the filters above" : ""
}

export function FilterPanel({ activeFilters, distinctConfig, onApply, metadataFields, transcriptionFields, role, open: openProp, onOpenChange }: Readonly<FilterPanelProps>) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }, [onOpenChange])
  const [rows, setRows] = useState<RowState[]>(() => buildRows(activeFilters, distinctConfig))
  const pinned = useCallLogsStore((s) => s.pinnedFilterFields)
  const setPinned = useCallLogsStore((s) => s.setPinnedFilterFields)

  // Reopening always starts from what is actually applied, like the legacy panel.
  useEffect(() => {
    if (open) setRows(buildRows(activeFilters, distinctConfig))
  }, [open, activeFilters, distinctConfig])

  const roleColumns = useMemo(() => columnsForRole(role), [role])
  const allowed = useMemo(() => new Set(roleColumns.map((c) => c.value)), [roleColumns])

  // A pin is only offered when it makes sense for this agent: the column is
  // allowed for the role and, for JSON columns, the field actually exists here.
  const quickAdd = useMemo(
    () =>
      pinned.filter((p) => {
        if (!allowed.has(p.column)) return false
        if (p.column === "metadata") return !!p.jsonField && metadataFields.includes(p.jsonField)
        if (p.column === "transcription_metrics") return !!p.jsonField && transcriptionFields.includes(p.jsonField)
        return true
      }),
    [pinned, allowed, metadataFields, transcriptionFields]
  )

  const complete = useMemo(
    () => rows.map((r, i) => rowToOperation(r, i)).filter((op): op is FilterOperation => op !== null),
    [rows]
  )

  const addRow = useCallback((preset: Partial<RowState> = {}) => {
    setRows((prev) => [
      ...prev,
      { id: `filter-${Date.now()}`, type: "filter", column: "", operation: "", value: "", jsonField: "", sortOrder: "asc", ...preset },
    ])
  }, [])

  const addFromPin = (p: PinnedFilterField) => {
    const operation = p.operation ?? defaultOperationFor(p.column)
    const noValue = operation === "exists" || operation === "json_exists"
    addRow({ column: p.column, jsonField: p.jsonField ?? "", operation, value: noValue ? "true" : "" })
  }

  const togglePin = (row: RowState) => {
    if (!row.column) return
    const key = pinKey(row)
    if (pinned.some((p) => pinKey(p) === key)) {
      setPinned(pinned.filter((p) => pinKey(p) !== key))
    } else {
      setPinned([...pinned, { column: row.column, ...(row.jsonField && { jsonField: row.jsonField }), ...(row.operation && { operation: row.operation }) }])
    }
  }

  const apply = () => {
    onApply(complete)
    setOpen(false)
  }

  const clearAll = () => {
    setRows([])
    onApply([])
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={V2_BTN}>
          <Filter className="h-4 w-4" />
          Filter
          {activeFilters.length > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--cl-accent)] px-1 text-[10.5px] font-semibold text-white">
              {activeFilters.length}
            </span>
          )}
          <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform", open && "rotate-180")} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={6} className={cn("w-auto min-w-[520px] max-w-[95vw] rounded-xl border-[var(--cl-border2)] bg-[var(--cl-raised)] p-0 text-[var(--cl-text)] shadow-[0_16px_40px_rgba(0,0,0,.35)]", V2_THEME)}>
        {quickAdd.length > 0 && (
          <div className="border-b border-[var(--cl-border2)] px-4 py-3">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quick add <span className="font-normal normal-case tracking-normal">· star a filter to pin its field here</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickAdd.map((p) => (
                <button
                  key={pinKey(p)}
                  type="button"
                  onClick={() => addFromPin(p)}
                  className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[var(--cl-border2)] bg-[var(--cl-panel2)] px-2.5 text-[13px] text-[var(--cl-text2)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]"
                >
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {p.jsonField || columnLabel(p.column)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-h-[50vh] space-y-2 overflow-y-auto p-3">
          {rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No filters, so every call in the selected period is shown.
            </p>
          ) : (
            rows.map((row) => {
              const isPinned = !!row.column && pinned.some((p) => pinKey(p) === pinKey(row))
              return (
                <div key={row.id} className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1">
                    <FilterRow
                      row={row}
                      onChange={(updated) => setRows((prev) => replaceRow(prev, row.id, updated))}
                      onRemove={() => setRows((prev) => withoutRow(prev, row.id))}
                      availableMetadataFields={metadataFields}
                      availableTranscriptionFields={transcriptionFields}
                      columnsForRole={roleColumns}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePin(row)}
                    disabled={!row.column}
                    title={isPinned ? "Unpin from Quick add" : "Pin this field to Quick add"}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:text-amber-500 disabled:opacity-30"
                  >
                    <Star className={cn("h-3.5 w-3.5", isPinned && "fill-amber-400 text-amber-400")} />
                  </button>
                </div>
              )
            })
          )}
          <div className="flex gap-4 pt-1">
            <button type="button" onClick={() => addRow()} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
              <Plus className="h-3.5 w-3.5" />
              Add filter
            </button>
            <button
              type="button"
              onClick={() => addRow({ type: "distinct" })}
              title="Keep one call per value, e.g. the latest call per customer"
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              + Unique by…
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--cl-border2)] px-4 py-2.5">
          <button type="button" onClick={clearAll} className="text-xs text-muted-foreground hover:text-red-500">
            Clear all
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {readyLabel(complete.length, rows.length)}
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={apply} disabled={complete.length === 0 && activeFilters.length === 0}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** The applied filters as plain-words chips; ✕ removes one straight away. */
// At most this many chips, even on a wide screen; the rest are behind "+N more".
const MAX_CHIPS = 3
const CHIP_GAP = 6
// room kept for the "+N more" pill
const MORE_PILL_WIDTH = 96

/**
 * Applied filters on one line: up to 3 whole chips (fewer when the row is
 * narrow), the rest folded into "+N more", which lists them all. Chips never
 * shrink into empty bubbles.
 */
export function FilterChips({ activeFilters, onChange, onEdit }: Readonly<{
  activeFilters: FilterOperation[]
  onChange: (ops: FilterOperation[]) => void
  /** Clicking a chip opens the filter panel to change it. */
  onEdit: () => void
}>) {
  const slotRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(Math.min(MAX_CHIPS, activeFilters.length))

  useLayoutEffect(() => {
    const slot = slotRef.current
    const measure = measureRef.current
    if (!slot || !measure) return
    const recompute = () => {
      const widths = Array.from(measure.children, (el) => (el as HTMLElement).offsetWidth).slice(0, MAX_CHIPS)
      const capped = activeFilters.length > MAX_CHIPS
      const room = slot.clientWidth
      const total = widths.reduce((a, w) => a + w, 0) + CHIP_GAP * Math.max(0, widths.length - 1)
      if (!capped && total <= room) return setFit(widths.length)
      let used = 0
      let n = 0
      for (const w of widths) {
        const next = used + (n ? CHIP_GAP : 0) + w
        if (next > room - MORE_PILL_WIDTH) break
        used = next
        n++
      }
      setFit(n)
    }
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(slot)
    return () => ro.disconnect()
  }, [activeFilters])

  if (activeFilters.length === 0) return null
  const remove = (id: string) => onChange(activeFilters.filter((op) => op.id !== id))
  const shown = activeFilters.slice(0, fit)
  const rest = activeFilters.length - shown.length
  return (
    <div className="relative flex flex-none items-center gap-1.5 border-b border-[var(--cl-border)] bg-[var(--cl-panel)] px-4 py-1.5">
      <span className="mr-0.5 flex-none text-[12.5px] text-[var(--cl-text3)]">Filtered by</span>
      {/* off-screen copy, only to measure each chip's natural width */}
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex gap-1.5">
        {activeFilters.map((op) => <FilterChip key={op.id} op={op} onRemove={() => {}} />)}
      </div>
      <div ref={slotRef} className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {shown.map((op) => <FilterChip key={op.id} op={op} onRemove={() => remove(op.id)} onEdit={onEdit} />)}
      {rest > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex h-6 flex-none items-center gap-1 rounded-full border border-[var(--cl-border2)] px-2.5 text-[12.5px] text-[var(--cl-text2)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]">
              {shown.length ? `+${rest} more` : `${rest} filters`}
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className={cn("w-[360px] border-[var(--cl-border2)] bg-[var(--cl-panel)] p-2 text-[var(--cl-text)]", V2_THEME)}>
            <p className="px-1.5 pb-1.5 pt-0.5 text-[12px] font-medium text-[var(--cl-text3)]">{activeFilters.length} filters</p>
            <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
              {activeFilters.map((op) => (
                <div key={op.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-[var(--cl-hover)]">
                  <button type="button" onClick={onEdit} className="min-w-0 flex-1 truncate text-left text-[var(--cl-text2)]" title={`${chipTitle(op)} — click to edit`}><ChipText op={op} /></button>
                  <RemoveButton onClick={() => remove(op.id)} />
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      </div>
      {activeFilters.length > 1 && (
        <button type="button" onClick={() => onChange([])} className="ml-auto flex-none pl-2 text-[12.5px] text-[var(--cl-text3)] hover:text-[var(--cl-text)]">
          Clear all
        </button>
      )}
    </div>
  )
}

function FilterChip({ op, onRemove, onEdit }: Readonly<{ op: FilterOperation; onRemove: () => void; onEdit?: () => void }>) {
  return (
    <span
      title={`${chipTitle(op)} — click to edit`}
      className="inline-flex h-6 max-w-[260px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--cl-border2)] bg-[var(--cl-hover)] pl-2.5 pr-1 text-[12.5px] text-[var(--cl-text2)] hover:border-[var(--cl-text3)]"
    >
      <button type="button" onClick={onEdit} className="min-w-0 truncate text-left"><ChipText op={op} /></button>
      <RemoveButton onClick={onRemove} />
    </span>
  )
}

function ChipText({ op }: Readonly<{ op: FilterOperation }>) {
  if (op.type === "distinct") return <>Unique by <b className="font-medium text-[var(--cl-text)]">{op.jsonField || columnLabel(op.column)}</b></>
  return (
    <>
      {columnLabel(op.column)}
      {op.jsonField && <span className="font-mono text-[11px]"> · {op.jsonField}</span>}{" "}
      <b className="font-medium text-[var(--cl-text)]">
        {operationLabel(op.operation).toLowerCase()}
        {op.operation !== "exists" && op.operation !== "json_exists" && ` ${op.value}`}
      </b>
    </>
  )
}

function RemoveButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove filter"
      className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full text-[var(--cl-text3)] hover:bg-[var(--cl-border)] hover:text-[var(--cl-text)]"
    >
      <X className="h-3 w-3" />
    </button>
  )
}

function chipTitle(op: FilterOperation): string {
  if (op.type === "distinct") return `Unique by ${op.jsonField || columnLabel(op.column)}`
  const value = op.operation === "exists" || op.operation === "json_exists" ? "" : ` ${op.value}`
  const field = op.jsonField ? ` · ${op.jsonField}` : ""
  return `${columnLabel(op.column)}${field} ${operationLabel(op.operation).toLowerCase()}${value}`
}
