'use client'

// Line-by-line diff of two texts (a prompt, a JSON config), unchanged runs folded.
// Used by Agent Config history and Prompt Forge version compare.
import React from 'react'
import { diffLines } from 'diff'

type LineType = 'added' | 'removed' | 'unchanged'

interface DiffLine {
  type: LineType | 'separator'
  content: string
  lineOld?: number
  lineNew?: number
  separatorCount?: number
  /** Stable React key, from the line numbers. */
  key: string
}

/** Every line of both texts, marked added / removed / unchanged, with its line numbers. */
function expandChanges(oldText: string, newText: string): DiffLine[] {
  const expanded: DiffLine[] = []
  let lineOld = 1
  let lineNew = 1
  for (const change of diffLines(oldText || '', newText || '')) {
    const raw = change.value
    const lines = raw.endsWith('\n') ? raw.slice(0, -1).split('\n') : raw.split('\n')
    for (const content of lines) {
      if (change.removed) {
        expanded.push({ type: 'removed', content, lineOld, key: `r${lineOld}` })
        lineOld++
      } else if (change.added) {
        expanded.push({ type: 'added', content, lineNew, key: `a${lineNew}` })
        lineNew++
      } else {
        expanded.push({ type: 'unchanged', content, lineOld, lineNew, key: `u${lineOld}-${lineNew}` })
        lineOld++
        lineNew++
      }
    }
  }
  return expanded
}

/** Indexes within `context` lines of a change; the rest gets folded. */
function linesNearChanges(lines: DiffLine[], context: number): Set<number> {
  const show = new Set<number>()
  for (const [i, l] of lines.entries()) {
    if (l.type === 'unchanged') continue
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) show.add(k)
  }
  return show
}

function separator(count: number, before: DiffLine | undefined): DiffLine {
  return { type: 'separator', content: '', separatorCount: count, key: `s-${before?.key ?? 'start'}` }
}

/** The diff with long unchanged runs folded into "N unchanged lines". Empty when nothing changed. */
function buildDiffLines(oldText: string, newText: string, context = 4): DiffLine[] {
  const expanded = expandChanges(oldText, newText)
  const show = linesNearChanges(expanded, context)
  if (show.size === 0) return []

  const result: DiffLine[] = []
  let skipped = 0
  for (const [i, line] of expanded.entries()) {
    if (!show.has(i)) {
      skipped++
      continue
    }
    if (skipped > 0) {
      result.push(separator(skipped, result.at(-1)))
      skipped = 0
    }
    result.push(line)
  }
  if (skipped > 0) result.push(separator(skipped, result.at(-1)))
  return result
}

const ROW_STYLE: Record<LineType, { row: string; gutter: string; sign: string; signClass: string }> = {
  added: { row: 'bg-green-500/10', gutter: 'bg-green-500/15', sign: '+', signClass: 'text-green-500' },
  removed: { row: 'bg-red-500/10', gutter: 'bg-red-500/15', sign: '−', signClass: 'text-red-500' },
  unchanged: { row: '', gutter: 'bg-muted/30', sign: ' ', signClass: 'text-transparent' },
}

const GUTTER = 'w-10 text-right pr-1.5 py-px select-none text-[11px] shrink-0 border-r border-border/50 text-muted-foreground/60'

function DiffRow({ line }: Readonly<{ line: DiffLine & { type: LineType } }>) {
  const style = ROW_STYLE[line.type]
  return (
    <div className={`flex min-h-[20px] ${style.row}`}>
      <span className={`${GUTTER} ${style.gutter}`}>{line.type === 'added' ? '' : (line.lineOld ?? '')}</span>
      <span className={`${GUTTER} ${style.gutter}`}>{line.type === 'removed' ? '' : (line.lineNew ?? '')}</span>
      <span className={`w-6 text-center py-px select-none shrink-0 font-semibold text-xs ${style.signClass}`}>{style.sign}</span>
      <span className="flex-1 pl-1 pr-3 py-px whitespace-pre-wrap break-all text-foreground">{line.content || ' '}</span>
    </div>
  )
}

function FoldedLines({ count }: Readonly<{ count: number }>) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 border-y text-muted-foreground select-none text-xs">
      <span>···</span>
      <span>{count === 1 ? '1 unchanged line' : `${count} unchanged lines`}</span>
    </div>
  )
}

export function PromptDiffViewer({
  oldText,
  newText,
  emptyMessage = 'No changes',
}: Readonly<{
  oldText: string
  newText: string
  emptyMessage?: string
}>) {
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
      {lines.map((line) =>
        line.type === 'separator'
          ? <FoldedLines key={line.key} count={line.separatorCount ?? 0} />
          : <DiffRow key={line.key} line={line as DiffLine & { type: LineType }} />,
      )}
    </div>
  )
}
