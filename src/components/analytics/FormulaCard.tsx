/**
 * One number divided by another on the canvas — "unique picked up ÷ unique
 * called", "task complete ÷ answered", anything a single `rate` chart can't
 * express because the two sides come from different aggregates. The division
 * already happened server-side (`/api/analytics/query`); this only formats
 * and shows the result. No drill-down — there is no single set of rows behind
 * a number that is really two queries divided.
 */
'use client'
import React from 'react'
import { AlertTriangle, Clock, GripVertical, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { FormulaContent, Widget, WidgetResult } from '@/types/analytics'
import { DRAG_HANDLE_CLASS } from './ChartCard'

export function FormulaCard({
  widget, result, isLoading, selected, canEdit, draggable, onSelect, onRemove,
}: Readonly<{
  widget: Widget
  result?: WidgetResult
  isLoading: boolean
  selected: boolean
  canEdit: boolean
  draggable: boolean
  onSelect: () => void
  onRemove: () => void
}>) {
  const spec = widget.spec as FormulaContent
  const round = spec.display?.round ?? 1
  const unit = spec.display?.unit ?? ''
  const raw = result?.data?.[0]?.value
  const value = raw === null || raw === undefined ? null : Number(raw)

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-colors dark:bg-gray-900',
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

      <div className="relative z-10 pointer-events-none flex h-full min-h-0 flex-col justify-center gap-1">
        <h3 className="truncate text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {widget.title}
        </h3>

        {isLoading && !result ? (
          <Skeleton className="h-8 w-24" />
        ) : result?.status === 'error' ? (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {result.error ?? 'Could not compute this'}
          </span>
        ) : result?.status === 'timeout' ? (
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="h-3.5 w-3.5 shrink-0" /> This took too long.
          </span>
        ) : value === null ? (
          <span className="text-3xl font-semibold text-gray-300 dark:text-gray-700">—</span>
        ) : (
          <span className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
            {value.toLocaleString(undefined, { minimumFractionDigits: round, maximumFractionDigits: round })}
            {unit}
          </span>
        )}
      </div>

      {canEdit && (
        <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          {draggable && (
            <button
              type="button"
              aria-label={`Move ${widget.title}`}
              className={cn(DRAG_HANDLE_CLASS, 'pointer-events-auto cursor-grab rounded p-1 text-gray-300 hover:text-gray-500 dark:text-gray-600')}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label={`Remove ${widget.title}`}
            onClick={onRemove}
            className="pointer-events-auto rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
