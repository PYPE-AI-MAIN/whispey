/**
 * A freeform note on the canvas — the Metabase pattern of a heading and a line
 * of italic description sitting above the charts it introduces, with nothing
 * behind it to query. Editing happens in the SidePanel like any other widget;
 * this only renders and selects.
 *
 * Deliberately not markdown: a `# ` prefix reads as a heading and everything
 * else is a paragraph. A full markdown renderer is a dependency for a feature
 * that is two visual styles.
 */
'use client'
import React from 'react'
import { GripVertical, Trash2, Type } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TextContent, Widget } from '@/types/analytics'
import { DRAG_HANDLE_CLASS } from './ChartCard'

function renderLine(line: string, i: number) {
  if (line.startsWith('## ')) {
    return (
      <h4 key={i} className="text-sm font-semibold text-foreground">
        {line.slice(3)}
      </h4>
    )
  }
  if (line.startsWith('# ')) {
    return (
      <h3 key={i} className="text-xl font-semibold text-foreground">
        {line.slice(2)}
      </h3>
    )
  }
  if (!line.trim()) return <div key={i} className="h-2" />
  return (
    <p key={i} className="text-sm italic text-muted-foreground">
      {line}
    </p>
  )
}

export function TextBlockCard({
  widget, selected, canEdit, draggable, onSelect, onRemove,
}: Readonly<{
  widget: Widget
  selected: boolean
  canEdit: boolean
  draggable: boolean
  onSelect: () => void
  onRemove: () => void
}>) {
  const text = (widget.spec as TextContent).text ?? ''

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-colors',
        selected
          ? 'border-blue-500 ring-1 ring-blue-500/30 dark:border-blue-400'
          : 'border-transparent hover:border-border'
      )}
    >
      <button
        type="button"
        aria-label="Edit text block"
        onClick={onSelect}
        className="absolute inset-0 z-0 cursor-pointer appearance-none bg-transparent border-0 p-0"
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden pointer-events-none">
        {text.trim() ? (
          text.split('\n').map((line, i) => renderLine(line, i))
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Type className="h-3.5 w-3.5" /> Click to write a heading or a note
          </span>
        )}
      </div>

      {canEdit && (
        <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          {draggable && (
            <button
              type="button"
              aria-label="Move this text block"
              className={cn(DRAG_HANDLE_CLASS, 'pointer-events-auto cursor-grab rounded p-1 text-muted-foreground hover:text-muted-foreground')}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Remove text block"
            onClick={onRemove}
            className="pointer-events-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
