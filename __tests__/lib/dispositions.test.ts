import { describe, it, expect } from 'vitest'
import {
  validateDispositions,
  dispositionsToAgentColumns,
  DISPOSITION_SUGGESTIONS,
  MAX_DISPOSITIONS,
  MAX_DESCRIPTION,
  mergeDispositions,
  parseStoredDispositions,
  validateRemoveKeys,
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
    expect(validateDispositions([{ key: 'a', description: 'x'.repeat(MAX_DESCRIPTION + 1) }]).ok).toBe(false)
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

describe('parseStoredDispositions', () => {
  it('reads the saved JSON list', () => {
    expect(parseStoredDispositions('[{"key":"a","description":"d"}]')).toEqual([{ key: 'a', description: 'd' }])
  })

  it.each([[null], [''], ['   '], ['not json'], ['{"a":1}'], [42]])('returns an empty list for %j', (raw) => {
    expect(parseStoredDispositions(raw)).toEqual([])
  })
})

describe('validateRemoveKeys', () => {
  it('trims and de-duplicates keys', () => {
    expect(validateRemoveKeys([' a ', 'a', 'b'])).toEqual({ ok: true, keys: ['a', 'b'] })
  })

  it('rejects non-arrays and invalid keys', () => {
    expect(validateRemoveKeys('a').ok).toBe(false)
    expect(validateRemoveKeys(['Bad Key']).ok).toBe(false)
    expect(validateRemoveKeys([5]).ok).toBe(false)
  })
})

describe('mergeDispositions', () => {
  const current = [
    { key: 'a', description: 'first' },
    { key: 'b', description: 'second' },
  ]

  it('adds a new key without touching the existing ones', () => {
    const result = mergeDispositions(current, [{ key: 'c', description: 'third' }], [])
    expect(result).toEqual({ ok: true, dispositions: [...current, { key: 'c', description: 'third' }] })
  })

  it('updates the description of an existing key in place', () => {
    const result = mergeDispositions(current, [{ key: 'a', description: 'changed' }], [])
    expect(result).toEqual({
      ok: true,
      dispositions: [{ key: 'a', description: 'changed' }, current[1]],
    })
  })

  it('removes keys that exist', () => {
    expect(mergeDispositions(current, [], ['a'])).toEqual({ ok: true, dispositions: [current[1]] })
  })

  it('refuses to remove a key that does not exist', () => {
    const result = mergeDispositions(current, [], ['zzz'])
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain('zzz')
  })

  it('can add and remove in one call', () => {
    const result = mergeDispositions(current, [{ key: 'c', description: 'third' }], ['a'])
    expect(result).toEqual({ ok: true, dispositions: [current[1], { key: 'c', description: 'third' }] })
  })

  it('keeps the size limit after merging', () => {
    const full = Array.from({ length: MAX_DISPOSITIONS }, (_, i) => ({ key: `k${i}`, description: 'd' }))
    expect(mergeDispositions(full, [{ key: 'extra', description: 'd' }], []).ok).toBe(false)
  })

  it('starts from an empty list', () => {
    expect(mergeDispositions([], [{ key: 'a', description: 'd' }], [])).toEqual({
      ok: true,
      dispositions: [{ key: 'a', description: 'd' }],
    })
  })
})

describe('description length', () => {
  it('allows long descriptions up to the limit, and not beyond', () => {
    expect(validateDispositions([{ key: 'rules', description: 'x'.repeat(MAX_DESCRIPTION) }]).ok).toBe(true)
    expect(validateDispositions([{ key: 'rules', description: 'x'.repeat(MAX_DESCRIPTION + 1) }]).ok).toBe(false)
    expect(MAX_DESCRIPTION).toBeGreaterThanOrEqual(10_000)
  })
})
