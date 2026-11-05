import { describe, it, expect, vi } from 'vitest'

vi.mock('openai', () => ({ OpenAI: class {} }))

import { parseFieldExtractorPrompt, buildSystemPrompt, buildUserPrompt } from '@/lib/transcriptProcessor'

describe('parseFieldExtractorPrompt', () => {
  it('parses a JSON array of {key, description}', () => {
    const json = JSON.stringify([{ key: 'call_outcome', description: 'How it ended' }])
    expect(parseFieldExtractorPrompt(json)).toEqual([{ key: 'call_outcome', description: 'How it ended' }])
  })

  it('drops entries missing a key or description', () => {
    const json = JSON.stringify([{ key: 'a', description: 'ok' }, { key: 'b' }, { description: 'c' }])
    expect(parseFieldExtractorPrompt(json)).toEqual([{ key: 'a', description: 'ok' }])
  })

  it('returns an empty list for invalid JSON or a non-array', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(parseFieldExtractorPrompt('not json')).toEqual([])
    expect(parseFieldExtractorPrompt('{"key":"a"}')).toEqual([])
    spy.mockRestore()
  })
})

describe('buildSystemPrompt', () => {
  it('lists each field and asks for "Unknown" when a value is missing', () => {
    const prompt = buildSystemPrompt([{ key: 'call_outcome', description: 'How it ended' }])
    expect(prompt).toContain('- call_outcome: How it ended')
    expect(prompt).toContain('"Unknown"')
  })

  it('substitutes {{variables}} into descriptions', () => {
    const prompt = buildSystemPrompt([{ key: 'name', description: 'Is this {{patient}}?' }], { patient: 'Asha' })
    expect(prompt).toContain('- name: Is this Asha?')
  })

  it('serialises object variable values as JSON', () => {
    const prompt = buildSystemPrompt([{ key: 'x', description: 'See {{meta}}' }], { meta: { a: 1 } })
    expect(prompt).toContain('See {"a":1}')
  })
})

describe('buildUserPrompt', () => {
  it('includes the transcript and a JSON skeleton of the requested keys', () => {
    const prompt = buildUserPrompt(
      [{ key: 'a', description: 'd' }, { key: 'b', description: 'd' }],
      'AGENT: hi\nUSER: hello'
    )
    expect(prompt).toContain('AGENT: hi\nUSER: hello')
    expect(prompt).toContain('"a": "..."')
    expect(prompt).toContain('"b": "..."')
  })
})
