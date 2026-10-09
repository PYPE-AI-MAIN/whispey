"use client"

import React from "react"
import { flexRender, type ColumnDef, type Row, type Table } from "@tanstack/react-table"
import { Inbox } from "lucide-react"
import { isRowFlaggedForRole } from "@/utils/callLogsUtils"
import type { CallLogsDensity } from "@/stores/callLogsStore"
import type { CallLog } from "@/types/logs"
import { cn } from "@/lib/utils"
import { V2_BTN } from "./theme"

const SELECT_COL_WIDTH = 44

interface CallLogsTableProps {
  table: Table<CallLog>
  density: CallLogsDensity
  role: string | null
  isLoading: boolean
  isBusy: boolean
  /** Another page is on its way: rows are dimmed and can't be opened. */
  pageLoading?: boolean
  hasFilters: boolean
  onClearFilters: () => void
  /** Row under the keyboard cursor (↑/↓), as an index into the current page. */
  cursorIndex: number
  /** Last-opened call, kept highlighted when coming back from its detail page. */
  selectedCallId: string | null
  navigatingCallId: string | null
  onOpen: (call: CallLog) => void
  /** Pointer resting on a row — used to start loading that call early. */
  onHover?: (call: CallLog) => void
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}

// The first data column stays pinned while the table scrolls sideways. When the
// selection checkbox column is present it is pinned too, and the data column sits
// right after it.
function stickyLeft(index: number, hasSelectColumn: boolean): number | null {
  if (index === 0) return 0
  if (index === 1 && hasSelectColumn) return SELECT_COL_WIDTH
  return null
}

// Column separators and the pinned column's edge are drawn as inset shadows, not
// borders, so they stay crisp on sticky cells (borders get dragged along unevenly).
function cellShadow(index: number, pinnedEdge: boolean, marker: string | null): string | undefined {
  const parts: string[] = []
  if (marker) parts.push(`inset 3px 0 0 ${marker}`)
  if (index > 0) parts.push("inset 1px 0 0 var(--cl-border)")
  if (pinnedEdge) parts.push("1px 0 0 var(--cl-border)")
  return parts.length ? parts.join(", ") : undefined
}

const HIGHLIGHT_BG = "linear-gradient(var(--cl-accent-soft), var(--cl-accent-soft)), var(--cl-bg)"

export function CallLogsTable({
  table, density, role, isLoading, isBusy, pageLoading = false, hasFilters, onClearFilters,
  cursorIndex, selectedCallId, navigatingCallId, onOpen, onHover, scrollContainerRef,
}: Readonly<CallLogsTableProps>) {
  const rows = table.getRowModel().rows
  const leafColumns = table.getVisibleLeafColumns()
  const hasSelectColumn = leafColumns[0]?.id === "select"
  const lastPinnedIndex = hasSelectColumn ? 1 : 0
  const compact = density === "compact"

  return (
    <div className="relative min-h-0 flex-1 bg-[var(--cl-bg)]">
      {/* thin progress bar while a page or refresh is loading */}
      <div className={cn("absolute inset-x-0 top-0 z-40 h-[2px] overflow-hidden transition-opacity", isBusy ? "opacity-100" : "pointer-events-none opacity-0")}>
        <div className="h-full animate-[progress-slide_1.2s_ease-in-out_infinite] bg-[var(--cl-accent)]" />
      </div>

      <div ref={scrollContainerRef} className={cn("absolute inset-0 overflow-auto transition-opacity", isBusy && "pointer-events-none opacity-60")}>
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h, i) => {
                  const left = stickyLeft(i, hasSelectColumn)
                  return (
                    <th
                      key={h.id}
                      style={{
                        minWidth: h.column.id === "select" ? SELECT_COL_WIDTH : (h.column.columnDef.minSize ?? 120),
                        width: h.column.id === "select" ? SELECT_COL_WIDTH : undefined,
                        left: left ?? undefined,
                        boxShadow: cellShadow(i, i === lastPinnedIndex, null),
                      }}
                      className={cn(
                        "sticky top-0 whitespace-nowrap border-b border-[var(--cl-border)] bg-[var(--cl-panel)] text-center text-[12.5px] font-medium text-[var(--cl-text3)]",
                        compact ? "px-3.5 py-[9px]" : "px-4 py-[11px]",
                        left === null ? "z-20" : "z-30"
                      )}
                    >
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className={cn("transition-opacity", pageLoading && "pointer-events-none opacity-40")} aria-busy={pageLoading}>
            {rows.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={leafColumns.length} className="h-[360px] text-center">
                  <div className="flex flex-col items-center gap-3 py-12 text-[var(--cl-text3)]">
                    <Inbox className="h-10 w-10" />
                    <p className="text-base font-semibold text-[var(--cl-text)]">No call logs found</p>
                    {hasFilters && (
                      <>
                        <p className="text-sm">No calls match your current filters.</p>
                        <button type="button" className={V2_BTN} onClick={onClearFilters}>Clear filters</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => {
                const atCursor = rowIndex === cursorIndex
                return (
                  <TableRow
                    key={row.id}
                    row={row}
                    rowIndex={rowIndex}
                    columns={table.options.columns}
                    visibleKey={leafColumns.map((c) => c.id).join(",")}
                    selected={row.getIsSelected()}
                    atCursor={atCursor}
                    highlighted={atCursor || selectedCallId === row.original.id}
                    flagged={isRowFlaggedForRole(row.original, role)}
                    navigating={navigatingCallId === row.original.id}
                    compact={compact}
                    hasSelectColumn={hasSelectColumn}
                    lastPinnedIndex={lastPinnedIndex}
                    onOpen={onOpen}
                    onHover={onHover}
                  />
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface TableRowProps {
  row: Row<CallLog>
  rowIndex: number
  /** Not read here: a new column set (or visible set) must re-render the row. */
  columns: ColumnDef<CallLog, any>[]
  visibleKey: string
  selected: boolean
  atCursor: boolean
  highlighted: boolean
  flagged: boolean
  navigating: boolean
  compact: boolean
  hasSelectColumn: boolean
  lastPinnedIndex: number
  onOpen: (call: CallLog) => void
  onHover?: (call: CallLog) => void
}

// Memoised so moving the keyboard cursor re-renders the two rows it touches, not
// every cell (tag and flag editors included) on the page.
const TableRow = React.memo(function TableRow({
  row, rowIndex, highlighted, atCursor, flagged, navigating, compact, hasSelectColumn, lastPinnedIndex, onOpen, onHover,
}: Readonly<TableRowProps>) {
  const call = row.original
  let marker: string | null = null
  if (atCursor) marker = "var(--cl-accent)"
  else if (flagged) marker = "var(--cl-red)"
  return (
    <tr
      data-call-id={call.id}
      data-row-index={rowIndex}
      onClick={() => onOpen(call)}
      onMouseEnter={onHover ? () => onHover(call) : undefined}
      className={cn("group cursor-pointer", navigating && "pointer-events-none")}
    >
      {row.getVisibleCells().map((cell, i) => {
        const left = stickyLeft(i, hasSelectColumn)
        return (
          <td
            key={cell.id}
            style={{
              left: left ?? undefined,
              background: highlighted ? HIGHLIGHT_BG : undefined,
              boxShadow: cellShadow(i, i === lastPinnedIndex, i === 0 ? marker : null),
            }}
            className={cn(
              "max-w-[320px] whitespace-nowrap border-b border-[var(--cl-border)] align-middle text-[var(--cl-text)]",
              compact ? "px-3.5 py-[9px] text-[14px]" : "px-4 py-[15px] text-[14.5px]",
              // Pinned cells need an opaque background, or scrolled columns show through.
              !highlighted && "bg-[var(--cl-bg)] group-hover:bg-[var(--cl-hover)]",
              left !== null && "sticky z-10"
            )}
          >
            {/* Every row is the same height: tall values (JSON metadata, long notes)
                are clipped here and stay readable through the cell's hover tooltip. */}
            <div className={cn("overflow-hidden leading-[1.5]", compact ? "max-h-7" : "max-h-8")}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          </td>
        )
      })}
    </tr>
  )
})
