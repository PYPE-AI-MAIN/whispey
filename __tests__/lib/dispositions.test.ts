import { describe, it, expect } from 'vitest'
import {
  validateDispositions,
  dispositionsToAgentColumns,
  DISPOSITION_SUGGESTIONS,
  MAX_DISPOSITIONS,
} from '@/lib/dispositions'

describe('validateDispositions', () => {
  it('accepts a well-formed list and trims values', () => {
    const result = validateDispositions([{ key: ' call_outcome ', description: '  How the call ended  ' }])
    expect(result).toEqual({ ok: true, dispositions: [{ key: 'call_outcome', description: 'How the call ended' }] })
  })

  it('accepts an empty list (used to switch dispositions off)', () => {
    expect(validateDispositions([])).toEqual({ ok: true, dispositions: [] })
  })

  it('rejects anything that is not an array', () => {
    expect(validateDispositions({ key: 'a' })).toEqual({ ok: false, error: 'dispositions must be an array' })
    expect(validateDispositions(undefined).ok).toBe(false)
  })

  it('rejects more than the maximum number of dispositions', () => {
    const tooMany = Array.from({ length: MAX_DISPOSITIONS + 1 }, (_, i) => ({ key: `k${i}`, description: 'd' }))
    const result = validateDispositions(tooMany)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain(String(MAX_DISPOSITIONS))
  })

  it.each([
    ['uppercase', 'CallOutcome'],
    ['leading digit', '1call'],
    ['spaces', 'call outcome'],
    ['hyphen', 'call-outcome'],
    ['empty', ''],
    ['too long', 'a'.repeat(41)],
  ])('rejects an invalid key (%s)', (_label, key) => {
    const result = validateDispositions([{ key, description: 'd' }])
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain('Invalid disposition key')
  })

  it('rejects a non-string key', () => {
    expect(validateDispositions([{ key: 5, description: 'd' }]).ok).toBe(false)
  })

  it('rejects a missing, blank or overlong description', () => {
    expect(validateDispositions([{ key: 'a' }]).ok).toBe(false)
    expect(validateDispositions([{ key: 'a', description: '   ' }]).ok).toBe(false)
    expect(validateDispositions([{ key: 'a', description: 'x'.repeat(501) }]).ok).toBe(false)
  })

  it('rejects duplicate keys', () => {
    const result = validateDispositions([
      { key: 'a', description: 'one' },
      { key: 'a', description: 'two' },
    ])
    expect(result).toEqual({ ok: false, error: 'Duplicate disposition key "a"' })
  })

  it('handles null items without throwing', () => {
    expect(validateDispositions([null]).ok).toBe(false)
  })
})

describe('dispositionsToAgentColumns', () => {
  it('turns extraction on and stores the prompt as a JSON string', () => {
    const list = [{ key: 'call_outcome', description: 'How it ended' }]
    const columns = dispositionsToAgentColumns(list)
    expect(columns.field_extractor).toBe(true)
    expect(JSON.parse(columns.field_extractor_prompt as string)).toEqual(list)
  })

  it('turns extraction off and clears the prompt for an empty list', () => {
    expect(dispositionsToAgentColumns([])).toEqual({ field_extractor: false, field_extractor_prompt: null })
  })
})

describe('DISPOSITION_SUGGESTIONS', () => {
  it('only offers suggestions that would pass validation, without duplicates', () => {
    const plain = DISPOSITION_SUGGESTIONS.map(({ key, description }) => ({ key, description }))
    expect(validateDispositions(plain).ok).toBe(true)
    expect(new Set(plain.map((s) => s.key)).size).toBe(plain.length)
  })

  it('groups every suggestion under a category', () => {
    expect(DISPOSITION_SUGGESTIONS.every((s) => s.category.length > 0)).toBe(true)
  })
})
