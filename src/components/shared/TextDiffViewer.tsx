'use client'

// Line-by-line diff of two texts (a prompt, a JSON config), unchanged runs folded.
// Used by Agent Config history and Prompt Forge version compare.
import React from 'react'
import { diffLines } from 'diff'

// ─────────────────────────────────────────────────────────────────────────────
// Diff utilities
// ─────────────────────────────────────────────────────────────────────────────

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'separator'
  content: string
  lineOld?: number
  lineNew?: number
  separatorCount?: number
}

function buildDiffLines(oldText: string, newText: string, context = 4): DiffLine[] {
  const changes = diffLines(oldText || '', newText || '')

  const expanded: DiffLine[] = []
  let lineOld = 1, lineNew = 1

  for (const change of changes) {
    const raw = change.value
    const lines = raw.endsWith('\n') ? raw.slice(0, -1).split('\n') : raw.split('\n')

    for (const line of lines) {
      if (change.removed) {
        expanded.push({ type: 'removed', content: line, lineOld })
        lineOld++
      } else if (change.added) {
        expanded.push({ type: 'added', content: line, lineNew })
        lineNew++
      } else {
        expanded.push({ type: 'unchanged', content: line, lineOld, lineNew })
        lineOld++
        lineNew++
      }
    }
  }

  const show = new Set<number>()
  expanded.forEach((l, i) => {
    if (l.type !== 'unchanged') {
      for (let k = Math.max(0, i - context); k <= Math.min(expanded.length - 1, i + context); k++) {
        show.add(k)
      }
    }
  })

  if (show.size === 0) return []

  const result: DiffLine[] = []
  let skipped = 0

  expanded.forEach((line, i) => {
    if (show.has(i)) {
      if (skipped > 0) {
        result.push({ type: 'separator', content: '', separatorCount: skipped })
        skipped = 0
      }
      result.push(line)
    } else {
      skipped++
    }
  })
  if (skipped > 0) result.push({ type: 'separator', content: '', separatorCount: skipped })

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff viewer
// ─────────────────────────────────────────────────────────────────────────────

export function PromptDiffViewer({
  oldText,
  newText,
  emptyMessage = 'No changes',
}: {
  oldText: string
  newText: string
  emptyMessage?: string
}) {
  const lines = buildDiffLines(oldText, newText)

  if (lines.length === 0) {
    return (
      <div className="flex items-center justify-center py-5 rounded-lg border border-dashed text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden font-mono text-xs leading-5">
      {lines.map((line, i) => {
        if (line.type === 'separator') {
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1 bg-muted/50 border-y text-muted-foreground select-none text-xs"
            >
              <span>···</span>
              <span>{line.separatorCount} unchanged line{line.separatorCount !== 1 ? 's' : ''}</span>
            </div>
          )
        }

        const isAdded   = line.type === 'added'
        const isRemoved = line.type === 'removed'

        const rowBg = isAdded
          ? 'bg-green-500/10'
          : isRemoved
            ? 'bg-red-500/10'
            : ''

        const gutterBg = isAdded
          ? 'bg-green-500/15'
          : isRemoved
            ? 'bg-red-500/15'
            : 'bg-muted/30'

        return (
          <div key={i} className={`flex min-h-[20px] ${rowBg}`}>
            <span className={`w-10 text-right pr-1.5 py-px select-none text-[11px] shrink-0 border-r border-border/50 text-muted-foreground/60 ${gutterBg}`}>
              {isAdded ? '' : (line.lineOld ?? '')}
            </span>
            <span className={`w-10 text-right pr-1.5 py-px select-none text-[11px] shrink-0 border-r border-border/50 text-muted-foreground/60 ${gutterBg}`}>
              {isRemoved ? '' : (line.lineNew ?? '')}
            </span>
            <span className={`w-6 text-center py-px select-none shrink-0 font-semibold text-xs ${
              isAdded   ? 'text-green-500' :
              isRemoved ? 'text-red-500'   :
              'text-transparent'
            }`}>
              {isAdded ? '+' : isRemoved ? '−' : ' '}
            </span>
            <span className="flex-1 pl-1 pr-3 py-px whitespace-pre-wrap break-all text-foreground">
              {line.content || '\u00A0'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

