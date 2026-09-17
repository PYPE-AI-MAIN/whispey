/**
 * One chart on the canvas — Confluence "Analytics Phase 1 and 2 — Build Spec"
 * §10.5.
 *
 * The chrome matters as much as the chart. A card that shows nothing has to say
 * why; an average over only the usable rows misleads unless the card says which
 * rows those were; and the count control belongs in the header rather than
 * behind a dialog, because it changes what the number means and nobody finds it
 * if it is hidden.
 */
'use client'
import React from 'react'
import { AlertTriangle, Clock, Copy, Download, EyeOff, GripVertical, List, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Widget, WidgetResult } from '@/types/analytics'
import { ChartRenderer } from './ChartRenderer'
import { coverage } from './chartData'

/** react-grid-layout only starts a drag from this class, so a click on the card selects it. */
export const DRAG_HANDLE_CLASS = 'chart-drag-handle'

export function ChartCard({
  widget, result, isLoading, selected, canEdit, draggable, categories, grainLabel, definition,
  onSelect, onOpenLogs, onEdit, onDuplicate, onRemove, onExport, onChangeGrain,
}: {
  widget: Widget
  result?: WidgetResult
  isLoading: boolean
  /** Known values of the field this chart splits by, so a zero shows as a zero. */
  categories?: string[] | null
  /** "Every call", or the name of whatever this chart counts one of. */
  grainLabel: string
  /** What the card counted, in words — "How many calls · only where why the call ended is completed". */
  definition: string
  selected: boolean
  canEdit: boolean
  /** Off on a phone: the canvas is for reading there, not for building. */
  draggable: boolean
  onSelect: () => void
  onOpenLogs: (dimensionValue?: string | null) => void
  onEdit: () => void
  onDuplicate: () => void
  onRemove: () => void
  onExport: () => void
  onChangeGrain: (grain: 'interaction' | 'entity') => void
}) {
  const rows = result?.data ?? []
  const cover = coverage(rows)
  const isKpi = widget.kind === 'kpi'
  // the line exists to disclose a shortfall. On a filtered count every row
  // counts, so "99 of 99 calls" says nothing and implies a universe of 99.
  const showCoverage = Boolean(cover && (cover.used < cover.total || widget.spec.dimension))
  const grain = widget.spec.grain ?? 'interaction'

  return (
    <div
      className={cn(
        // the grid owns the rectangle; the card fills whatever it is given
        'group relative flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-colors dark:bg-gray-900',
        selected
          ? 'border-blue-500 ring-1 ring-blue-500/30 dark:border-blue-400'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {draggable && canEdit && (
              <button
                aria-label={`Move ${widget.title}`}
                // faint rather than invisible: a handle nobody can see is a
                // feature nobody finds
                className={cn(
                  DRAG_HANDLE_CLASS,
                  '-ml-1 cursor-grab rounded p-0.5 text-gray-300 opacity-40 transition hover:text-gray-500 group-hover:opacity-100 focus:opacity-100 dark:text-gray-600'
                )}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            )}
            <h3 className="truncate text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {widget.title}
            </h3>
          </div>

          <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[11px] text-gray-400">
            {/* it changes what the number means, so it is never hidden in a dialog */}
            {canEdit && (
              <button
                className="shrink-0 underline-offset-2 hover:text-gray-600 hover:underline dark:hover:text-gray-300"
                onClick={(e) => {
                  e.stopPropagation()
                  onChangeGrain(grain === 'entity' ? 'interaction' : 'entity')
                }}
              >
                {grainLabel}
              </button>
            )}
            {/* "Completed calls · 110" is not a number anyone can check */}
            {/* wrapped, not truncated: a definition you cannot read is the
                same as no definition */}
            <span className="line-clamp-2 text-gray-400/80 dark:text-gray-500" title={definition}>
              {canEdit ? '· ' : ''}
              {definition}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Options for ${widget.title}`}
              className="rounded p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onOpenLogs()}>
              <List className="mr-2 h-3.5 w-3.5" /> View calls
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="mr-2 h-3.5 w-3.5" /> Export CSV
            </DropdownMenuItem>
            {canEdit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                </DropdownMenuItem>
                {/* how most people build their second chart */}
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onRemove} className="text-red-600 focus:text-red-600">
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn('min-h-0 flex-1 px-4', isKpi ? 'pb-1' : 'pb-2')}>
        <CardBody widget={widget} result={result} isLoading={isLoading} rows={rows} categories={categories} onSelect={onOpenLogs} />
      </div>

      {/* an average over only the usable rows misleads unless the card says so */}
      <div className="flex items-center justify-between gap-2 px-4 pb-3 text-[11px] text-gray-400 dark:text-gray-500">
        {cover && showCoverage ? (
          <button
            className="truncate underline-offset-2 hover:text-gray-600 hover:underline dark:hover:text-gray-300"
            onClick={(e) => {
              e.stopPropagation()
              onOpenLogs()
            }}
          >
            {cover.used.toLocaleString()} of {cover.total.toLocaleString()} calls
            {cover.pct < 95 && cover.pct > 0 && ` · ${cover.pct}% have this field`}
          </button>
        ) : (
          <span />
        )}
        {result?.meta?.lookbackDays ? <span>Best of 90 days</span> : null}
      </div>
    </div>
  )
}

/** The five states a card has to be able to show, and never a blank rectangle. */
function CardBody({
  widget, result, isLoading, rows, categories, onSelect,
}: {
  widget: Widget
  result?: WidgetResult
  isLoading: boolean
  rows: WidgetResult['data'] & object
  categories?: string[] | null
  onSelect: (value: string | null) => void
}) {
  if (isLoading && !result) return <Skeleton className="h-full w-full rounded-lg" />

  if (result?.status === 'timeout') {
    return <State icon={<Clock className="h-4 w-4" />} text={result.error ?? 'This chart took too long.'} />
  }
  if (result?.status === 'skipped') {
    return <State icon={<Clock className="h-4 w-4" />} text="Not loaded yet — reload to try again." />
  }
  if (result?.status === 'error') {
    const denied = /permission/i.test(result.error ?? '')
    return (
      <State
        icon={denied ? <EyeOff className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        text={denied ? 'You do not have access to this field.' : (result.error ?? 'Could not draw this chart.')}
        tone={denied ? 'muted' : 'warn'}
      />
    )
  }
  if (result && rows.length === 0 && !categories?.length) {
    // "no rows" and "this field is no longer produced" look identical on screen
    // unless the card distinguishes them
    return <State text={widget.spec.display?.empty_text ?? 'Nothing in this range.'} tone="muted" />
  }

  return (
    <ChartRenderer
      kind={widget.kind}
      rows={rows}
      spec={widget.spec}
      bucket={result?.meta?.bucket}
      categories={categories}
      onSelect={onSelect}
      compact={'w' in (widget.layout ?? {}) && (widget.layout as { w: number }).w <= 4}
    />
  )
}

function State({ icon, text, tone = 'warn' }: { icon?: React.ReactNode; text: string; tone?: 'warn' | 'muted' }) {
  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center text-xs',
        tone === 'warn' ? 'text-amber-600 dark:text-amber-500' : 'text-gray-400 dark:text-gray-500'
      )}
    >
      {icon}
      <span className="leading-snug">{text}</span>
    </div>
  )
}
