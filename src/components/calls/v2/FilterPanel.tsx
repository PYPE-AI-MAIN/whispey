"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
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
}

export function FilterPanel({ activeFilters, distinctConfig, onApply, metadataFields, transcriptionFields, role }: Readonly<FilterPanelProps>) {
  const [open, setOpen] = useState(false)
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
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">
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
            <p className="py-4 text-center text-sm text-gray-500">
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
                      onChange={(updated) => setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))}
                      onRemove={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
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
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-gray-300 hover:text-amber-500 disabled:opacity-30 dark:text-gray-600"
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
          <button type="button" onClick={clearAll} className="text-xs text-gray-500 hover:text-red-500">
            Clear all
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {complete.length > 0 ? `${complete.length} ready` : rows.length > 0 ? "Complete the filters above" : ""}
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
export function FilterChips({ activeFilters, onChange }: Readonly<{ activeFilters: FilterOperation[]; onChange: (ops: FilterOperation[]) => void }>) {
  if (activeFilters.length === 0) return null
  const remove = (id: string) => onChange(activeFilters.filter((op) => op.id !== id))
  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
      {activeFilters.map((op) => (
        <span
          key={op.id}
          className="inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--cl-border2)] bg-[var(--cl-hover)] pl-2.5 pr-1 text-[13px] text-[var(--cl-text2)]"
        >
          {op.type === "distinct" ? (
            <>Unique by <b className="font-medium text-[var(--cl-text)]">{op.jsonField || columnLabel(op.column)}</b></>
          ) : (
            <>
              {columnLabel(op.column)}
              {op.jsonField && <span className="font-mono text-[11px]">· {op.jsonField}</span>}
              <b className="font-medium text-[var(--cl-text)]">
                {operationLabel(op.operation).toLowerCase()}
                {op.operation !== "exists" && op.operation !== "json_exists" && ` ${op.value}`}
              </b>
            </>
          )}
          <button
            type="button"
            onClick={() => remove(op.id)}
            aria-label="Remove filter"
            className="grid h-[18px] w-[18px] place-items-center rounded-full text-[var(--cl-text3)] hover:bg-[var(--cl-border)] hover:text-[var(--cl-text)]"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {activeFilters.length > 1 && (
        <button type="button" onClick={() => onChange([])} className="shrink-0 text-[13px] text-[var(--cl-text3)] hover:text-[var(--cl-text)]">
          Clear all
        </button>
      )}
    </div>
  )
}
