import { describe, expect, it } from 'vitest'
import { canonicalJson, sameSnapshot } from '@/server/promptForge/snapshot'

const FIELDS = ['system_prompt', 'variables', 'temperature', 'messages'] as const

describe('canonicalJson', () => {
  it('ignores key order and reads undefined as null', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: undefined } })).toBe(canonicalJson({ a: { c: null, d: 2 }, b: 1 }))
  })
  it('keeps array order', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]))
  })
})

describe('sameSnapshot', () => {
  const base = {
    system_prompt: 'You are Priya.',
    variables: [{ name: 'clinic', value: 'Sunrise', description: '' }],
    temperature: 0.7,
    messages: [{ id: '1', role: 'user', content: 'hi' }],
  }
  it('is the same when only key order differs', () => {
    const reordered = {
      messages: [{ content: 'hi', role: 'user', id: '1' }],
      temperature: 0.7,
      variables: [{ description: '', value: 'Sunrise', name: 'clinic' }],
      system_prompt: 'You are Priya.',
    }
    expect(sameSnapshot(base, reordered, FIELDS)).toBe(true)
  })
  it('notices a changed prompt, setting or conversation', () => {
    expect(sameSnapshot(base, { ...base, system_prompt: 'You are Raj.' }, FIELDS)).toBe(false)
    expect(sameSnapshot(base, { ...base, temperature: 0.2 }, FIELDS)).toBe(false)
    expect(sameSnapshot(base, { ...base, messages: [] }, FIELDS)).toBe(false)
  })
  it('treats a missing field like an empty one', () => {
    expect(sameSnapshot({ ...base, temperature: null }, { system_prompt: base.system_prompt, variables: base.variables, messages: base.messages }, FIELDS)).toBe(true)
  })
})
