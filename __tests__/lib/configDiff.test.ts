import { describe, it, expect } from 'vitest'
import { buildSideBySideRows, hasChanges, sanitizeForDiff, serializeForDiff, extractPrompt, omitPrompt } from '@/lib/configDiff'

describe('buildSideBySideRows', () => {
  it('marks identical text as fully unchanged with no changed rows', () => {
    const rows = buildSideBySideRows('a\nb\nc', 'a\nb\nc')
    expect(hasChanges(rows)).toBe(false)
  })

  it('pairs a single changed line row-for-row', () => {
    const rows = buildSideBySideRows('a\nb\nc', 'a\nB\nc')
    const changed = rows.filter(r => r.type === 'changed') as any[]
    expect(changed).toHaveLength(1)
    expect(changed[0].left.content).toBe('b')
    expect(changed[0].right.content).toBe('B')
  })

  it('collapses unchanged runs beyond the context window', () => {
    const oldLines = Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n')
    const newLines = oldLines.replace('line10', 'CHANGED')
    const rows = buildSideBySideRows(oldLines, newLines, 2)
    expect(rows.some(r => r.type === 'collapsed')).toBe(true)
    const collapsed = rows.filter(r => r.type === 'collapsed') as any[]
    const collapsedLineCount = collapsed.reduce((sum, g) => sum + g.rows.length, 0)
    // 20 unchanged lines minus the 1 changed line minus 2*context kept around it
    expect(collapsedLineCount).toBe(20 - 1 - 4)
  })

  it('does not collapse anything shorter than the context window', () => {
    const rows = buildSideBySideRows('a\nb\nc', 'a\nB\nc', 2)
    expect(rows.some(r => r.type === 'collapsed')).toBe(false)
  })

  it('pads mismatched add/remove block lengths with nulls', () => {
    const rows = buildSideBySideRows('a\nb\nc', 'a\nX\nY\nZ\nc')
    const changed = rows.filter(r => r.type === 'changed') as any[]
    expect(changed).toHaveLength(3)
    expect(changed[0].left?.content).toBe('b')
    expect(changed[1].left).toBeNull()
    expect(changed[2].left).toBeNull()
    expect(changed.map(c => c.right.content)).toEqual(['X', 'Y', 'Z'])
  })
})

describe('sanitizeForDiff', () => {
  it('strips secret fields that always differ between snapshots', () => {
    const clean = sanitizeForDiff({ agent: { whispey_api_key: 'x', token_hash: 'y', name: 'foo' } })
    expect(clean.agent.whispey_api_key).toBeUndefined()
    expect(clean.agent.token_hash).toBeUndefined()
    expect(clean.agent.name).toBe('foo')
  })

  it('does not mutate the input object', () => {
    const original = { agent: { whispey_api_key: 'x' } }
    sanitizeForDiff(original)
    expect(original.agent.whispey_api_key).toBe('x')
  })

  it('produces identical output for objects that differ only in key order', () => {
    const a = { agent: { b: 1, a: 2, nested: { y: 1, x: 2 } } }
    const b = { agent: { a: 2, b: 1, nested: { x: 2, y: 1 } } }
    expect(JSON.stringify(sanitizeForDiff(a))).toBe(JSON.stringify(sanitizeForDiff(b)))
  })

  it('preserves array element order', () => {
    const clean = sanitizeForDiff({ agent: { tools: ['b', 'a'] } })
    expect(clean.agent.tools).toEqual(['b', 'a'])
  })
})

describe('extractPrompt / omitPrompt', () => {
  const config = { agent: { assistant: [{ prompt: 'hello', name: 'bot' }] } }

  it('extracts the prompt text from the assistant snapshot', () => {
    expect(extractPrompt(config)).toBe('hello')
  })

  it('returns empty string when there is no prompt', () => {
    expect(extractPrompt({})).toBe('')
  })

  it('strips the prompt but keeps everything else', () => {
    const rest = omitPrompt(config)
    expect(rest.agent.assistant[0].prompt).toBeUndefined()
    expect(rest.agent.assistant[0].name).toBe('bot')
  })

  it('does not mutate the input', () => {
    omitPrompt(config)
    expect(config.agent.assistant[0].prompt).toBe('hello')
  })
})

describe('serializeForDiff', () => {
  it('expands embedded newlines into real line breaks', () => {
    const text = serializeForDiff({ prompt: 'line one\nline two\nline three' })
    expect(text.split('\n').length).toBeGreaterThan(1)
    expect(text).toContain('line one')
    expect(text).toContain('line two')
  })

  it('isolates a small edit inside a multi-line string to one changed line', () => {
    const before = serializeForDiff({ prompt: 'alpha\nbeta\ngamma' })
    const after = serializeForDiff({ prompt: 'alpha\nBETA\ngamma' })
    const rows = buildSideBySideRows(before, after, 0)
    const changed = rows.filter(r => r.type === 'changed') as any[]
    expect(changed).toHaveLength(1)
    expect(changed[0].left.content.trim()).toBe('beta')
    expect(changed[0].right.content.trim()).toBe('BETA')
  })
})
