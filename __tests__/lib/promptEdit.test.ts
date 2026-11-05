import { describe, expect, it } from 'vitest'
import { applyPromptEdit, parsePromptEdit } from '@/lib/promptEdit'

describe('parsePromptEdit', () => {
  it('reads find and replace', () => {
    expect(parsePromptEdit('FIND:\nAsk for the date.\nREPLACE:\nAsk for the date and time.\n')).toEqual({
      find: 'Ask for the date.',
      replace: 'Ask for the date and time.',
    })
  })
  it('keeps multi-line text and allows an empty replacement (a deletion)', () => {
    expect(parsePromptEdit('FIND:\nline one\nline two\nREPLACE:\n')).toEqual({ find: 'line one\nline two', replace: '' })
  })
  it('is null for anything else', () => {
    expect(parsePromptEdit('just some code')).toBeNull()
    expect(parsePromptEdit('FIND:\n\nREPLACE:\nx')).toBeNull()
  })
})

describe('applyPromptEdit', () => {
  const prompt = 'You are Priya.\nAsk for the date.\nBe polite.'
  it('replaces the one exact match', () => {
    expect(applyPromptEdit(prompt, { find: 'Ask for the date.', replace: 'Ask for the date and time.' })).toEqual({
      ok: true,
      prompt: 'You are Priya.\nAsk for the date and time.\nBe polite.',
    })
  })
  it('refuses text that is gone or appears twice', () => {
    expect(applyPromptEdit(prompt, { find: 'Ask for the name.', replace: 'x' })).toMatchObject({ ok: false })
    expect(applyPromptEdit('Hi. Hi.', { find: 'Hi.', replace: 'Hello.' })).toMatchObject({ ok: false })
  })
})
