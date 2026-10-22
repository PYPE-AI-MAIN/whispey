"use client"

import React, { useMemo, useState } from "react"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import { Columns3, GripVertical, Search, Check, Minus, ChevronRight, Maximize2, X, RotateCcw, Eye } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
const GROUPS = Object.keys(GROUP_LABEL) as ColumnGroup[]

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

type TickState = boolean | "indeterminate"

// Sizes are inline so they never depend on Tailwind having generated an arbitrary class.
// The popover height follows the space Radix measures below the button, so it never runs off screen.
const POPOVER_SIZE: React.CSSProperties = { width: 340, maxWidth: "calc(100vw - 16px)", maxHeight: "min(560px, calc(var(--radix-popover-content-available-height, 100vh) - 12px))" }
const DIALOG_SIZE: React.CSSProperties = { width: 820, maxWidth: "calc(100% - 2rem)", height: "min(720px, calc(100vh - 80px))" }

export function ColumnsPicker(props: Readonly<ColumnsPickerProps>) {
  const { columns, shownIds, disabledReason } = props
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

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

  const shownCount = shownIds.filter((id) => columns.some((c) => c.id === id)).length

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={V2_BTN}>
            <Columns3 className="h-4 w-4" />
            Columns
            <span className="rounded-[5px] bg-[var(--cl-hover)] px-[5px] text-[12px] tabular-nums text-[var(--cl-text3)]">
              {shownCount}/{columns.length}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" collisionPadding={8} style={POPOVER_SIZE} className={cn("flex flex-col rounded-xl border-[var(--cl-border2)] bg-[var(--cl-raised)] p-0 text-[var(--cl-text)] shadow-[0_16px_40px_rgba(0,0,0,.35)]", V2_THEME)}>
          <PickerBody
            {...props}
            onExpand={() => {
              setOpen(false)
              setExpanded(true)
            }}
          />
        </PopoverContent>
      </Popover>

      {/* The same picker in a bigger window: the shown order on the left, every section on the right. */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          showCloseButton={false}
          style={DIALOG_SIZE}
          className={cn("flex flex-col gap-0 overflow-hidden rounded-xl border-[var(--cl-border2)] bg-[var(--cl-raised)] p-0 text-[var(--cl-text)] sm:max-w-none", V2_THEME)}
        >
          <DialogTitle className="sr-only">Customize columns</DialogTitle>
          <PickerBody {...props} wide onClose={() => setExpanded(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Two views of the same columns:
 * - Columns: every column in its own section. Ticking one shows it; it stays where it is.
 * - Order: only the shown columns, flat, dragged into the order the table uses.
 * Shown comes first (it's what people check most): the first tab in the dropdown,
 * the left pane in the bigger window.
 */
function PickerBody({ columns, shownIds, onToggle, onReorder, onReset, onShowAll, onSetColumns, wide = false, onExpand, onClose }: Readonly<ColumnsPickerProps & {
  wide?: boolean
  onExpand?: () => void
  onClose?: () => void
}>) {
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<"columns" | "order">("order")
  const q = query.trim().toLowerCase()
  const matches = (c: PickerColumn) => !q || c.label.toLowerCase().includes(q)

  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  const shown = shownIds.map((id) => byId.get(id)).filter((c): c is PickerColumn => !!c)
  const shownSet = new Set(shownIds)
  const allShown = shown.length === columns.length

  const sections = (
    <SectionList columns={columns} shownSet={shownSet} matches={matches} searching={!!q} onToggle={onToggle} onSetColumns={onSetColumns} />
  )
  const order = <ShownList shown={shown} shownIds={shownIds} matches={matches} searching={!!q} onToggle={onToggle} onReorder={onReorder} />

  return (
    <>
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
        {onExpand && (
          <button type="button" onClick={onExpand} title="Open in a bigger window" aria-label="Open in a bigger window" className={HEADER_ICON_BTN}>
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} title="Close" aria-label="Close" className={HEADER_ICON_BTN}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {wide ? (
        // side by side; stacked on a phone
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            <PaneLabel right={shown.length}>Shown · drag to reorder</PaneLabel>
            {order}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--cl-border2)] pb-2 sm:border-l sm:border-t-0">
            <PaneLabel>All columns</PaneLabel>
            {sections}
          </div>
        </div>
      ) : (
        <>
          <div role="tablist" className="flex gap-1 border-b border-[var(--cl-border2)] px-2.5 py-1.5">
            <TabButton active={tab === "order"} onClick={() => setTab("order")}>
              Shown <span className="tabular-nums text-[var(--cl-text3)]">{shown.length}</span>
            </TabButton>
            <TabButton active={tab === "columns"} onClick={() => setTab("columns")}>
              All columns
            </TabButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">{tab === "columns" ? sections : order}</div>
        </>
      )}

      <div className="flex items-center gap-2 border-t border-[var(--cl-border2)] px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] tabular-nums text-[var(--cl-text3)]">
          {shown.length} of {columns.length} shown
        </span>
        <FooterButton icon={<RotateCcw className="h-3.5 w-3.5" />} label="Reset" hint="Every column, in its original order. Undoes your hiding and dragging." onClick={onReset} />
        <FooterButton
          icon={<Eye className="h-3.5 w-3.5" />}
          label={allShown ? "All shown" : "Show all"}
          hint={allShown ? "Every column is already in the table" : `Add the ${columns.length - shown.length} hidden columns to the end of the table. Your order stays.`}
          onClick={onShowAll}
          disabled={allShown}
        />
      </div>
    </>
  )
}

function FooterButton({ icon, label, hint, onClick, disabled }: Readonly<{ icon: React.ReactNode; label: string; hint: string; onClick: () => void; disabled?: boolean }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* a disabled button fires no hover, so the tooltip sits on a wrapper */}
        <span className="inline-flex">
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--cl-border2)] bg-[var(--cl-panel2)] px-2 text-[12.5px] font-medium text-[var(--cl-text2)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)] disabled:cursor-default disabled:opacity-50 disabled:hover:bg-[var(--cl-panel2)] disabled:hover:text-[var(--cl-text2)]"
          >
            {icon}
            {label}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56 text-xs">
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}

const HEADER_ICON_BTN =
  "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border border-[var(--cl-border2)] bg-[var(--cl-panel2)] text-[var(--cl-text2)] hover:text-[var(--cl-text)]"

function TabButton({ active, onClick, children }: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-[13px] font-medium",
        active ? "bg-[var(--cl-hover)] text-[var(--cl-text)]" : "text-[var(--cl-text3)] hover:text-[var(--cl-text)]"
      )}
    >
      {children}
    </button>
  )
}

function PaneLabel({ children, right }: Readonly<{ children: React.ReactNode; right?: number }>) {
  return (
    <div className="flex items-center justify-between px-3 pb-1 pt-2.5 text-[11.5px] font-semibold uppercase tracking-[.07em] text-[var(--cl-text3)]">
      <span>{children}</span>
      {right !== undefined && <span className="tabular-nums">{right}</span>}
    </div>
  )
}

function sectionState(shownCount: number, total: number): TickState {
  if (shownCount === total) return true
  return shownCount > 0 ? "indeterminate" : false
}

/** Every column, always under its own section. The section's tick shows or hides all of it. */
function SectionList({ columns, shownSet, matches, searching, onToggle, onSetColumns }: Readonly<{
  columns: PickerColumn[]
  shownSet: Set<string>
  matches: (c: PickerColumn) => boolean
  searching: boolean
  onToggle: ColumnsPickerProps["onToggle"]
  onSetColumns: ColumnsPickerProps["onSetColumns"]
}>) {
  const groups = GROUPS.map((g) => ({ group: g, all: columns.filter((c) => c.group === g) })).filter((x) => x.all.length > 0)
  // Collapsed so every section fits at a glance; a lone section starts open.
  const [openGroups, setOpenGroups] = useState<Set<ColumnGroup>>(() => new Set(groups.length === 1 ? GROUPS : []))
  const toggleGroup = (g: ColumnGroup) =>
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })

  const visible = groups.map((x) => ({ ...x, list: x.all.filter(matches) })).filter((x) => x.list.length > 0)
  if (visible.length === 0) return <p className="px-3 py-1.5 text-xs text-[var(--cl-text3)]">No matching columns</p>

  return (
    <>
      {visible.map(({ group, all, list }) => {
        const shownCount = all.filter((c) => shownSet.has(c.id)).length
        const state = sectionState(shownCount, all.length)
        // while searching, every section with a match is open
        const isOpen = searching || openGroups.has(group)
        return (
          <div key={group}>
            <div className="flex items-center gap-1 pr-2 hover:bg-[var(--cl-hover)]">
              <button
                type="button"
                onClick={() => onSetColumns(all, state !== true)}
                title={state === true ? `Hide all ${GROUP_LABEL[group]} columns` : `Show all ${GROUP_LABEL[group]} columns`}
                aria-label={`${GROUP_LABEL[group]}: show all`}
                aria-pressed={state === "indeterminate" ? "mixed" : state}
                className="grid h-8 w-8 shrink-0 place-items-center"
              >
                <Tick state={state} />
              </button>
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                aria-expanded={isOpen}
                className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-[13px] font-semibold text-[var(--cl-text)]"
              >
                <span className="min-w-0 flex-1 truncate">{GROUP_LABEL[group]}</span>
                <span className="text-[12px] font-normal tabular-nums text-[var(--cl-text3)]">
                  {shownCount}/{all.length}
                </span>
                <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-[var(--cl-text3)] transition-transform", isOpen && "rotate-90")} />
              </button>
            </div>
            {isOpen &&
              list.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onToggle(c, !shownSet.has(c.id))}
                  className="flex w-full items-center gap-2 py-[5px] pl-[38px] pr-3 text-left text-[13.5px] hover:bg-[var(--cl-hover)]"
                >
                  <Tick state={shownSet.has(c.id)} />
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                </button>
              ))}
          </div>
        )
      })}
    </>
  )
}

/** Only the shown columns, flat, with their section as a tag. Drag to set the table's order. */
function ShownList({ shown, shownIds, matches, searching, onToggle, onReorder }: Readonly<{
  shown: PickerColumn[]
  shownIds: string[]
  matches: (c: PickerColumn) => boolean
  searching: boolean
  onToggle: ColumnsPickerProps["onToggle"]
  onReorder: ColumnsPickerProps["onReorder"]
}>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = shownIds.indexOf(String(e.active.id))
    const to = shownIds.indexOf(String(e.over.id))
    if (from < 0 || to < 0) return
    onReorder(arrayMove(shownIds, from, to))
  }

  if (shown.length === 0) return <p className="px-3 py-1.5 text-xs text-[var(--cl-text3)]">No columns shown</p>
  // dragging a filtered list would hide where things land, so search shows a plain list
  if (searching) {
    const list = shown.filter(matches)
    if (list.length === 0) return <p className="px-3 py-1.5 text-xs text-[var(--cl-text3)]">No matching columns shown</p>
    return (
      <>
        {list.map((c) => (
          <div key={c.id} className="flex items-center pl-7 pr-3 hover:bg-[var(--cl-hover)]">
            <ShownRowBody column={c} onToggle={onToggle} />
          </div>
        ))}
      </>
    )
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={shownIds} strategy={verticalListSortingStrategy}>
        {shown.map((c) => <SortableShownRow key={c.id} column={c} onToggle={onToggle} />)}
      </SortableContext>
    </DndContext>
  )
}

function SortableShownRow({ column, onToggle }: Readonly<{ column: PickerColumn; onToggle: ColumnsPickerProps["onToggle"] }>) {
  const s = useSortable({ id: column.id })
  return (
    <div
      ref={s.setNodeRef}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition }}
      className={cn(
        "flex items-center pr-3 hover:bg-[var(--cl-hover)]",
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
      <ShownRowBody column={column} onToggle={onToggle} />
    </div>
  )
}

function ShownRowBody({ column, onToggle }: Readonly<{ column: PickerColumn; onToggle: ColumnsPickerProps["onToggle"] }>) {
  return (
    <button type="button" onClick={() => onToggle(column, false)} title="Hide this column" className="flex min-w-0 flex-1 items-center gap-2 py-[5px] text-left text-[13.5px]">
      <Tick state />
      <span className="min-w-0 flex-1 truncate">{column.label}</span>
      <span className="shrink-0 rounded border border-[var(--cl-border2)] px-1 text-[11px] text-[var(--cl-text3)]">
        {GROUP_LABEL[column.group]}
      </span>
    </button>
  )
}

function Tick({ state }: Readonly<{ state: TickState }>) {
  const on = state !== false
  return (
    <span
      className={cn(
        "grid h-4 w-4 shrink-0 place-items-center rounded border",
        on ? "border-[var(--cl-accent)] bg-[var(--cl-accent)] text-white" : "border-[var(--cl-border2)] bg-[var(--cl-panel)]"
      )}
    >
      {state === true && <Check className="h-3 w-3" strokeWidth={3} />}
      {state === "indeterminate" && <Minus className="h-3 w-3" strokeWidth={3} />}
    </span>
  )
}
