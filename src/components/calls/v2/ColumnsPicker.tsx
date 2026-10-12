"use client"

import React, { useMemo, useState } from "react"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import { Columns3, GripVertical, Search, Check, Plus, ListChecks } from "lucide-react"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { V2_BTN, V2_THEME } from "./theme"

export type ColumnGroup = "basic" | "metadata" | "transcription_metrics" | "metrics"

export interface PickerColumn {
  /** Table column id, e.g. `call_id`, `metadata-region`, `transcription-lead_status`. */
  id: string
  /** Key inside its group's visibleColumns list. */
  key: string
  group: ColumnGroup
  label: string
}

const GROUP_LABEL: Record<ColumnGroup, string> = {
  basic: "Call",
  metadata: "Metadata",
  transcription_metrics: "Dispositions",
  metrics: "Metrics",
}

interface ColumnsPickerProps {
  /** Every column the user may show, across all groups. */
  columns: PickerColumn[]
  /** Visible column ids, already in display order. */
  shownIds: string[]
  onToggle: (column: PickerColumn, visible: boolean) => void
  onReorder: (shownIds: string[]) => void
  onReset: () => void
  onShowAll: () => void
  /** Shows or hides a whole section at once, e.g. every Metadata column. */
  onSetColumns: (columns: PickerColumn[], visible: boolean) => void
  /** Shown but not clickable, with this reason on hover (e.g. while a campaign is selected). */
  disabledReason?: string
}

export function ColumnsPicker({ columns, shownIds, onToggle, onReorder, onReset, onShowAll, onSetColumns, disabledReason }: Readonly<ColumnsPickerProps>) {
  const [query, setQuery] = useState("")
  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  const q = query.trim().toLowerCase()
  const matches = (c: PickerColumn) => !q || c.label.toLowerCase().includes(q)

  const shown = shownIds.map((id) => byId.get(id)).filter((c): c is PickerColumn => !!c)
  const shownSet = new Set(shownIds)
  const hiddenByGroup = (Object.keys(GROUP_LABEL) as ColumnGroup[])
    .map((g) => [g, columns.filter((c) => c.group === g && !shownSet.has(c.id) && matches(c))] as const)
    .filter(([, list]) => list.length > 0)
  // Every section, always listed above the scroll, so one at the bottom of the
  // list (e.g. Metrics) is still visible. Click to show or hide it whole.
  const sections = (Object.keys(GROUP_LABEL) as ColumnGroup[])
    .map((g) => {
      const all = columns.filter((c) => c.group === g)
      return { group: g, all, shownCount: all.filter((c) => shownSet.has(c.id)).length }
    })
    .filter((x) => x.all.length > 0)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = shownIds.indexOf(String(e.active.id))
    const to = shownIds.indexOf(String(e.over.id))
    if (from < 0 || to < 0) return
    onReorder(arrayMove(shownIds, from, to))
  }

  // A disabled button shows no tooltip of its own, so the reason sits on a wrapper.
  if (disabledReason) {
    return (
      <span title={disabledReason} className="inline-flex cursor-not-allowed">
        <button type="button" disabled className={V2_BTN}>
          <Columns3 className="h-4 w-4" />
          Columns
        </button>
      </span>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={V2_BTN}>
          <Columns3 className="h-4 w-4" />
          Columns
          <span className="rounded-[5px] bg-[var(--cl-hover)] px-[5px] text-[12px] tabular-nums text-[var(--cl-text3)]">
            {shown.length}/{columns.length}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className={cn("flex max-h-[min(640px,calc(100vh-140px))] w-[330px] flex-col rounded-xl border-[var(--cl-border2)] bg-[var(--cl-raised)] p-0 text-[var(--cl-text)] shadow-[0_16px_40px_rgba(0,0,0,.35)]", V2_THEME)}>
        <div className="flex items-center gap-1.5 border-b border-[var(--cl-border2)] p-2.5">
          <label className="flex h-[30px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--cl-border2)] bg-[var(--cl-panel2)] px-2 text-[var(--cl-text3)]">
            <Search className="h-3.5 w-3.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a column…"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-[var(--cl-text)] outline-none placeholder:text-[var(--cl-text3)]"
            />
          </label>
          <SectionsMenu sections={sections} onSetColumns={onSetColumns} />
        </div>

        {/* Two panes that scroll on their own: what's shown on top, what isn't
            below — so the hidden sections are always in view. */}
        <div className="min-h-[120px] flex-1 overflow-y-auto pb-2">
          <SectionLabel left={q ? "Shown" : "Shown · drag to reorder"} right={shown.filter(matches).length} />
          {shown.length === 0 && <p className="px-3 py-1.5 text-xs text-[var(--cl-text3)]">No columns shown</p>}
          {q ? (
            shown.filter(matches).map((c) => <ColumnRow key={c.id} column={c} shown onToggle={onToggle} />)
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
              <SortableContext items={shownIds} strategy={verticalListSortingStrategy}>
                {shown.map((c) => <SortableColumnRow key={c.id} column={c} onToggle={onToggle} />)}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {hiddenByGroup.length > 0 && (
        // sized to its columns, up to half the picker; scrolls past that
        <div className="max-h-[50%] shrink-0 overflow-y-auto border-t border-[var(--cl-border2)] pb-2">
          {hiddenByGroup.map(([group, list]) => (
            <React.Fragment key={group}>
              <SectionLabel
                left={GROUP_LABEL[group]}
                right={list.length}
                action={
                  <button
                    type="button"
                    onClick={() => onSetColumns(list, true)}
                    title={`Show all ${list.length} ${GROUP_LABEL[group]} columns`}
                    className="inline-flex items-center gap-0.5 rounded px-1 font-medium normal-case tracking-normal text-[var(--cl-accent)] hover:bg-[var(--cl-hover)]"
                  >
                    <Plus className="h-3 w-3" /> Select all
                  </button>
                }
              />
              {list.map((c) => <ColumnRow key={c.id} column={c} shown={false} onToggle={onToggle} />)}
            </React.Fragment>
          ))}
        </div>
        )}

        <div className="flex items-center justify-between border-t border-[var(--cl-border2)] px-3 py-2 text-[13px]">
          <button type="button" onClick={onReset} className="text-[var(--cl-text3)] hover:text-[var(--cl-text)]">
            Reset to default
          </button>
          <button type="button" onClick={onShowAll} className="text-[var(--cl-text3)] hover:text-[var(--cl-text)]">
            Show all
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SectionLabel({ left, right, action }: Readonly<{ left: string; right: number; action?: React.ReactNode }>) {
  return (
    <div className="flex items-center justify-between px-3 pb-1 pt-2.5 text-[11.5px] font-semibold uppercase tracking-[.07em] text-[var(--cl-text3)]">
      <span>{left}</span>
      <span className="flex items-center gap-2">
        {action && <span className="text-[12px]">{action}</span>}
        <span className="tabular-nums">{right}</span>
      </span>
    </div>
  )
}

function sectionState(shownCount: number, total: number): boolean | "indeterminate" {
  if (shownCount === total) return true
  return shownCount > 0 ? "indeterminate" : false
}

/** Whole sections on or off in one click, without scrolling to find them. */
function SectionsMenu({ sections, onSetColumns }: Readonly<{
  sections: Array<{ group: ColumnGroup; all: PickerColumn[]; shownCount: number }>
  onSetColumns: ColumnsPickerProps["onSetColumns"]
}>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Show or hide whole sections"
          className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg border border-[var(--cl-border2)] bg-[var(--cl-panel2)] px-2 text-[13px] text-[var(--cl-text2)] hover:text-[var(--cl-text)]"
        >
          <ListChecks className="h-3.5 w-3.5" />
          Sections
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("w-56", V2_THEME)}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Show whole sections</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sections.map(({ group, all, shownCount }) => {
          const full = shownCount === all.length
          return (
            <DropdownMenuCheckboxItem
              key={group}
              checked={sectionState(shownCount, all.length)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onSetColumns(all, !full)}
              className="text-[13px]"
            >
              <span className="flex-1">{GROUP_LABEL[group]}</span>
              <span className="ml-3 tabular-nums text-xs text-muted-foreground">{shownCount}/{all.length}</span>
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Tick({ on }: Readonly<{ on: boolean }>) {
  return (
    <span
      className={cn(
        "grid h-4 w-4 shrink-0 place-items-center rounded border",
        on ? "border-[var(--cl-accent)] bg-[var(--cl-accent)] text-white" : "border-[var(--cl-border2)] bg-[var(--cl-panel)]"
      )}
    >
      {on && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  )
}

function ColumnRow({ column, shown, onToggle }: Readonly<{ column: PickerColumn; shown: boolean; onToggle: ColumnsPickerProps["onToggle"] }>) {
  return (
    <button
      type="button"
      onClick={() => onToggle(column, !shown)}
      className="flex w-full items-center gap-2 py-[5px] pl-[30px] pr-3 text-left text-[13.5px] hover:bg-[var(--cl-hover)]"
    >
      <Tick on={shown} />
      <span className="min-w-0 flex-1 truncate">{column.label}</span>
      <span className="shrink-0 rounded border border-[var(--cl-border2)] px-1 text-[11px] text-[var(--cl-text3)]">
        {GROUP_LABEL[column.group]}
      </span>
    </button>
  )
}

function SortableColumnRow({ column, onToggle }: Readonly<{ column: PickerColumn; onToggle: ColumnsPickerProps["onToggle"] }>) {
  const s = useSortable({ id: column.id })
  return (
    <div
      ref={s.setNodeRef}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition }}
      className={cn(
        "flex items-center gap-0.5 pr-3 text-[13.5px] hover:bg-[var(--cl-hover)]",
        s.isDragging && "relative z-10 bg-[var(--cl-raised)] opacity-90 shadow-md"
      )}
    >
      <button
        type="button"
        {...s.attributes}
        {...s.listeners}
        aria-label={`Move ${column.label}`}
        className="grid h-7 w-7 shrink-0 cursor-grab place-items-center text-[var(--cl-text3)] opacity-60 hover:opacity-100"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => onToggle(column, false)} className="flex min-w-0 flex-1 items-center gap-2 py-[5px] text-left">
        <Tick on />
        <span className="min-w-0 flex-1 truncate">{column.label}</span>
        <span className="shrink-0 rounded border border-[var(--cl-border2)] px-1 text-[11px] text-[var(--cl-text3)]">
          {GROUP_LABEL[column.group]}
        </span>
      </button>
    </div>
  )
}
