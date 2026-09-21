/**
 * One number divided by another on the canvas — "unique picked up ÷ unique
 * called", "task complete ÷ answered", anything a single `rate` chart can't
 * express because the two sides come from different aggregates. The division
 * already happened server-side (`/api/analytics/query`); this only formats
 * and shows the result. No drill-down — there is no single set of rows behind
 * a number that is really two queries divided.
 *
 * The chrome deliberately mirrors `ChartCard`: same header position, same
 * title style, same definition line, same number size. A card that sits in
 * the same grid as eleven others and lays itself out differently reads as
 * broken, and a bare "78.1%" with no definition is a number nobody can check.
 */
'use client'
import React from 'react'
import { AlertTriangle, Clock, GripVertical, Info, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { FormulaContent, Widget, WidgetResult } from '@/types/analytics'
import { DRAG_HANDLE_CLASS } from './ChartCard'

export function FormulaCard({
  widget, result, isLoading, selected, canEdit, draggable, definition, onSelect, onRemove,
}: Readonly<{
  widget: Widget
  result?: WidgetResult
  isLoading: boolean
  selected: boolean
  canEdit: boolean
  draggable: boolean
  /** What the card divided, in words — "Unique count of phone number ÷ Count of calls". */
  definition: string
  onSelect: () => void
  onRemove: () => void
}>) {
  const spec = widget.spec as FormulaContent
  const round = spec.display?.round ?? 1
  const unit = spec.display?.unit ?? ''
  const raw = result?.data?.[0]?.value
  const value = raw === null || raw === undefined ? null : Number(raw)
  // same reason as ChartCard: a two-row-tall card has no room for text-3xl
  const short = (((widget.layout ?? {}) as { h?: number }).h ?? 3) <= 2

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-colors dark:bg-gray-900',
        selected
          ? 'border-blue-500 ring-1 ring-blue-500/30 dark:border-blue-400'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700'
      )}
    >
      <button
        type="button"
        aria-label={`Select ${widget.title}`}
        onClick={onSelect}
        className="absolute inset-0 z-0 cursor-pointer appearance-none bg-transparent border-0 p-0"
      />

      <div className="relative z-10 pointer-events-none flex shrink-0 items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {draggable && canEdit && (
              <button
                aria-label={`Move ${widget.title}`}
                className={cn(
                  DRAG_HANDLE_CLASS,
                  'pointer-events-auto -ml-1 cursor-grab rounded p-0.5 text-gray-300 opacity-40 transition hover:text-gray-500 group-hover:opacity-100 focus:opacity-100 dark:text-gray-600'
                )}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            )}
            <h3 className="truncate text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {widget.title}
            </h3>
            {/* the same "how is this calculated" affordance every other card
                has — a divided number needs it more, not less */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="How this percentage is calculated"
                    className="pointer-events-auto shrink-0 text-gray-300 outline-none transition hover:text-gray-500 focus-visible:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="max-w-[220px] text-xs">
                  {spec.op === 'percent'
                    ? 'The first number divided by the second, times 100. Each side is its own query over the same filters.'
                    : 'The first number divided by the second. Each side is its own query over the same filters.'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="mt-0.5 min-w-0 text-[11px] text-gray-400">
            <span className="line-clamp-1 text-gray-400/80 dark:text-gray-500" title={definition}>
              {definition}
            </span>
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            aria-label={`Remove ${widget.title}`}
            onClick={onRemove}
            className="pointer-events-auto shrink-0 rounded p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-gray-800"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="relative z-10 pointer-events-none min-h-0 flex-1 overflow-hidden px-4 pb-3">
        <FormulaValue isLoading={isLoading} result={result} value={value} round={round} unit={unit} short={short} />
      </div>
    </div>
  )
}

/** The same four states `ChartCard`'s body draws, condensed to one number instead of a chart. */
function FormulaValue({
  isLoading, result, value, round, unit, short,
}: Readonly<{
  isLoading: boolean
  result?: WidgetResult
  value: number | null
  round: number
  unit: string
  short: boolean
}>) {
  if (isLoading && !result) return <Skeleton className="h-full w-full rounded-lg" />

  if (result?.status === 'error') {
    return (
      <State icon={<AlertTriangle className="h-3.5 w-3.5 shrink-0" />} text={result.error ?? 'Could not compute this'} tone="warn" />
    )
  }

  if (result?.status === 'timeout') {
    return <State icon={<Clock className="h-3.5 w-3.5 shrink-0" />} text="This took too long." tone="muted" />
  }

  return (
    <div className="flex h-full flex-col justify-center overflow-hidden">
      <div
        className={cn(
          'truncate font-semibold tabular-nums text-gray-900 dark:text-gray-50',
          short ? 'text-2xl' : 'text-3xl',
          value === null && 'text-gray-400 dark:text-gray-500'
        )}
      >
        {value === null
          ? '—'
          : `${value.toLocaleString(undefined, { minimumFractionDigits: round, maximumFractionDigits: round })}${unit}`}
      </div>
    </div>
  )
}

function State({ icon, text, tone }: Readonly<{ icon: React.ReactNode; text: string; tone: 'warn' | 'muted' }>) {
  return (
    <div className="flex h-full items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <span className={tone === 'warn' ? 'text-amber-500' : 'text-gray-400'}>{icon}</span>
      <span className="line-clamp-2">{text}</span>
    </div>
  )
}
