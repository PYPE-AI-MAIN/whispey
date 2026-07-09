'use client'

import React, { useState } from 'react'
import { buildSideBySideRows, hasChanges, type DiffRow } from '@/lib/configDiff'

function Cell({ cell, tone }: { cell: { num: number; content: string; changed: boolean } | null; tone: 'left' | 'right' }) {
  if (!cell) {
    return <div className="flex bg-muted/30 min-h-[1.25rem]" />
  }
  const bg = cell.changed ? (tone === 'left' ? 'bg-red-500/10' : 'bg-green-500/10') : ''
  const marker = cell.changed ? (tone === 'left' ? '−' : '+') : ' '
  const markerColor = cell.changed ? (tone === 'left' ? 'text-red-500' : 'text-green-500') : 'text-transparent'
  return (
    <div className={`flex ${bg}`}>
      <span className="w-9 shrink-0 text-right pr-2 py-px text-muted-foreground/60 select-none tabular-nums">{cell.num}</span>
      <span className={`w-4 shrink-0 py-px select-none font-semibold ${markerColor}`}>{marker}</span>
      <span className="flex-1 pr-3 py-px whitespace-pre-wrap break-all text-foreground">{cell.content || ' '}</span>
    </div>
  )
}

function CollapsedRow({ count, onExpand }: { count: number; onExpand: () => void }) {
  return (
    <div className="col-span-2 grid grid-cols-2 border-y bg-muted/40">
      <button
        onClick={onExpand}
        className="col-span-2 text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors underline underline-offset-2"
      >
        Expand {count} line{count !== 1 ? 's' : ''} ...
      </button>
    </div>
  )
}

export function SideBySideDiff({
  oldText,
  newText,
  leftLabel = 'Published version',
  rightLabel = 'Current changes',
}: {
  oldText: string
  newText: string
  leftLabel?: string
  rightLabel?: string
}) {
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
            if (expanded.has(idx)) {
              return (
                <React.Fragment key={idx}>
                  {row.rows.map((r, j) => (
                    <div key={j} className="grid grid-cols-2 border-l-0">
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
                key={idx}
                count={row.rows.length}
                onExpand={() => setExpanded(prev => new Set(prev).add(idx))}
              />
            )
          }
          return (
            <div key={idx} className="grid grid-cols-2">
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
