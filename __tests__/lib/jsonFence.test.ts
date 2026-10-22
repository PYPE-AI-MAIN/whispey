import { describe, expect, test } from 'vitest'
import { extractJsonFence, stripJsonFencesForHistory } from '@/lib/jsonFence'

describe('extractJsonFence', () => {
  test('parses the last fenced json block', () => {
    const text = 'here you go\n```json\n{"a":1}\n```'
    expect(extractJsonFence(text)).toEqual({ a: 1 })
  })

  test('returns null when there is no fence', () => {
    expect(extractJsonFence('just text')).toBeNull()
  })

  test('returns null when the fence is unterminated (still streaming)', () => {
    expect(extractJsonFence('```json\n{"a":1}')).toBeNull()
  })

  test('returns null on malformed json inside the fence', () => {
    expect(extractJsonFence('```json\n{not valid\n```')).toBeNull()
  })
})

describe('stripJsonFencesForHistory', () => {
  test('replaces a fenced block with the placeholder', () => {
    const text = 'before\n```json\n{"a":1}\n```\nafter'
    expect(stripJsonFencesForHistory(text, '[omitted]')).toBe('before\n[omitted]\nafter')
  })

  test('leaves text with no fence untouched', () => {
    expect(stripJsonFencesForHistory('no fence here', '[omitted]')).toBe('no fence here')
  })

  test('replaces multiple fenced blocks', () => {
    const text = '```json\n{"a":1}\n```mid```json\n{"b":2}\n```'
    expect(stripJsonFencesForHistory(text, 'X')).toBe('Xmid' + 'X')
  })
})
