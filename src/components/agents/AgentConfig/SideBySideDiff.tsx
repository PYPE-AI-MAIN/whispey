'use client'

import React, { useState } from 'react'
import { buildSideBySideRows, hasChanges } from '@/lib/configDiff'

const TONE_STYLES = {
  left: { bg: 'bg-red-500/10', marker: '−', color: 'text-red-500' },
  right: { bg: 'bg-green-500/10', marker: '+', color: 'text-green-500' },
} as const

function cellKey(row: { left: { num: number } | null; right: { num: number } | null }, prefix: string): string {
  return `${prefix}-${row.left?.num ?? '_'}-${row.right?.num ?? '_'}`
}

function Cell({ cell, tone }: Readonly<{ cell: { num: number; content: string; changed: boolean } | null; tone: 'left' | 'right' }>) {
  if (!cell) {
    return <div className="flex bg-muted/30 min-h-[1.25rem]" />
  }
  const style = TONE_STYLES[tone]
  const bg = cell.changed ? style.bg : ''
  const marker = cell.changed ? style.marker : ' '
  const markerColor = cell.changed ? style.color : 'text-transparent'
  return (
    <div className={`flex ${bg}`}>
      <span className="w-9 shrink-0 text-right pr-2 py-px text-muted-foreground/60 select-none tabular-nums">{cell.num}</span>
      <span className={`w-4 shrink-0 py-px select-none font-semibold ${markerColor}`}>{marker}</span>
      <span className="flex-1 pr-3 py-px whitespace-pre-wrap break-all text-foreground">{cell.content || ' '}</span>
    </div>
  )
}

function CollapsedRow({ count, onExpand }: Readonly<{ count: number; onExpand: () => void }>) {
  return (
    <div className="col-span-2 grid grid-cols-2 border-y bg-muted/40">
      <button
        onClick={onExpand}
        className="col-span-2 text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors underline underline-offset-2"
      >
        Expand {count} {count === 1 ? 'line' : 'lines'} ...
      </button>
    </div>
  )
}

export function SideBySideDiff({
  oldText,
  newText,
  leftLabel = 'Published version',
  rightLabel = 'Current changes',
}: Readonly<{
  oldText: string
  newText: string
  leftLabel?: string
  rightLabel?: string
}>) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const rows = buildSideBySideRows(oldText, newText, 0)

  if (!hasChanges(rows)) {
    return (
      <div className="flex items-center justify-center py-6 rounded-lg border border-dashed text-xs text-muted-foreground">
        No changes to publish
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden font-mono text-xs leading-5">
      <div className="grid grid-cols-2 border-b bg-muted/20">
        <div className="px-3 py-2 flex items-center gap-2 text-[11px] font-medium text-foreground">
          {leftLabel} <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">Main</span>
        </div>
        <div className="px-3 py-2 flex items-center gap-2 text-[11px] font-medium text-foreground border-l">
          {rightLabel} <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">Main</span>
        </div>
      </div>

      <div className="max-h-[65vh] overflow-y-auto">
        {rows.map((row, idx) => {
          if (row.type === 'collapsed') {
            const groupKey = cellKey(row.rows[0] ?? { left: null, right: null }, 'collapsed')
            if (expanded.has(idx)) {
              return (
                <React.Fragment key={groupKey}>
                  {row.rows.map(r => (
                    <div key={cellKey(r, 'expanded')} className="grid grid-cols-2 border-l-0">
                      <Cell cell={r.left} tone="left" />
                      <div className="border-l">
                        <Cell cell={r.right} tone="right" />
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              )
            }
            return (
              <CollapsedRow
                key={groupKey}
                count={row.rows.length}
                onExpand={() => setExpanded(prev => new Set(prev).add(idx))}
              />
            )
          }
          return (
            <div key={cellKey(row, 'row')} className="grid grid-cols-2">
              <Cell cell={row.left} tone="left" />
              <div className="border-l">
                <Cell cell={row.right} tone="right" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
