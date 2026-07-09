import { diffLines } from 'diff'

// Keys that always differ between snapshots (secrets, hashes) and would show
// as noise in a diff even when nothing meaningful changed.
const DIFF_NOISE_KEYS = ['whispey_api_key', 'token_hash', 'whispey_key_id']

// Recursively sorts object keys so two objects with identical values but
// different key insertion order serialize to identical text (arrays keep
// their order since it's semantically meaningful, e.g. tool/filler lists).
function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    const sorted: Record<string, any> = {}
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key])
    return sorted
  }
  return value
}

// Splits a sanitized config into its prompt text and everything else, so the
// diff view can show "Prompt" and "Settings" as separate, independently
// navigable sections. Mirrors the same prompt lookup used elsewhere
// (agentVersionHelpers/ConfigHistory) so both agree on where the prompt lives.
export function extractPrompt(config: any): string {
  return config?.agent?.assistant?.[0]?.prompt ?? config?.agent?.prompt ?? ''
}

export function omitPrompt(config: any): any {
  if (!config) return config
  const clone = JSON.parse(JSON.stringify(config))
  if (clone?.agent?.assistant?.[0]) delete clone.agent.assistant[0].prompt
  if (clone?.agent) delete clone.agent.prompt
  return clone
}

export function sanitizeForDiff(config: any): any {
  if (!config) return config
  const clone = JSON.parse(JSON.stringify(config))
  if (clone?.agent) {
    for (const key of DIFF_NOISE_KEYS) delete clone.agent[key]
  }
  return canonicalize(clone)
}

// JSON.stringify escapes real newlines inside string values as literal "\n",
// which collapses a multi-line prompt onto a single line of diff text — any
// tiny edit then makes the diff flag the *entire* prompt as changed. This
// serializer keeps embedded newlines as real line breaks instead, so the
// line-diff aligns prompt text line-by-line. Output is diff-display text
// only — not meant to be parsed back as JSON.
export function serializeForDiff(value: any, indent = 0): string {
  const pad = '  '.repeat(indent)
  const childPad = '  '.repeat(indent + 1)

  if (value === null || value === undefined) return 'null'

  if (typeof value === 'string') {
    if (value.includes('\n')) return `"${value.replace(/\n/g, `\n${childPad}`)}"`
    return JSON.stringify(value)
  }

  if (typeof value !== 'object') return JSON.stringify(value)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map(v => `${childPad}${serializeForDiff(v, indent + 1)}`)
    return `[\n${items.join(',\n')}\n${pad}]`
  }

  const keys = Object.keys(value)
  if (keys.length === 0) return '{}'
  const items = keys.map(k => `${childPad}${JSON.stringify(k)}: ${serializeForDiff(value[k], indent + 1)}`)
  return `{\n${items.join(',\n')}\n${pad}}`
}

export interface DiffCell {
  num: number
  content: string
  changed: boolean
}

export interface SideBySideRow {
  type: 'unchanged' | 'changed'
  left: DiffCell | null
  right: DiffCell | null
}

export interface CollapsedGroup {
  type: 'collapsed'
  rows: SideBySideRow[]
}

export type DiffRow = SideBySideRow | CollapsedGroup

function toLines(text: string): string[] {
  if (!text) return []
  return text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n')
}

// Builds a side-by-side (old | new) diff of two texts. Unchanged runs longer
// than `context` lines on each side of a change are collapsed into a group.
export function buildSideBySideRows(oldText: string, newText: string, context = 2): DiffRow[] {
  const changes = diffLines(oldText ?? '', newText ?? '')
  const rows: SideBySideRow[] = []
  let leftNum = 1
  let rightNum = 1
  let i = 0

  while (i < changes.length) {
    const change = changes[i]

    if (!change.added && !change.removed) {
      for (const line of toLines(change.value)) {
        rows.push({
          type: 'unchanged',
          left: { num: leftNum++, content: line, changed: false },
          right: { num: rightNum++, content: line, changed: false },
        })
      }
      i++
      continue
    }

    let removedLines: string[] = []
    let addedLines: string[] = []

    if (change.removed) {
      removedLines = toLines(change.value)
      i++
      if (i < changes.length && changes[i].added) {
        addedLines = toLines(changes[i].value)
        i++
      }
    } else {
      addedLines = toLines(change.value)
      i++
    }

    const max = Math.max(removedLines.length, addedLines.length)
    for (let k = 0; k < max; k++) {
      const left = k < removedLines.length ? { num: leftNum++, content: removedLines[k], changed: true } : null
      const right = k < addedLines.length ? { num: rightNum++, content: addedLines[k], changed: true } : null
      rows.push({ type: 'changed', left, right })
    }
  }

  const show = new Set<number>()
  rows.forEach((row, idx) => {
    if (row.type === 'changed') {
      for (let k = Math.max(0, idx - context); k <= Math.min(rows.length - 1, idx + context); k++) show.add(k)
    }
  })

  const result: DiffRow[] = []
  let bucket: SideBySideRow[] = []
  rows.forEach((row, idx) => {
    if (show.has(idx)) {
      if (bucket.length) {
        result.push({ type: 'collapsed', rows: bucket })
        bucket = []
      }
      result.push(row)
    } else {
      bucket.push(row)
    }
  })
  if (bucket.length) result.push({ type: 'collapsed', rows: bucket })

  return result
}

export function hasChanges(rows: DiffRow[]): boolean {
  return rows.some(r => r.type === 'changed')
}
