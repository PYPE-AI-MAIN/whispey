import { describe, it, expect } from 'vitest'
import { AWAY_PROMPT_MAX_CHARS, customAwayPrompt } from '@/config/agentDefaults'
import { awayPromptToSave, isAwayPromptDirty } from '@/utils/awayPrompt'

const DEFAULT = 'You write ONE short spoken line.\n\nRULES: ...'

describe('customAwayPrompt', () => {
  it.each([undefined, null, '', '   ', '\n\t', 42, {}, 'x'.repeat(AWAY_PROMPT_MAX_CHARS + 1)])('drops %j', (v) => {
    expect(customAwayPrompt(v)).toBeUndefined()
  })

  it('keeps real text, trimmed, up to the cap', () => {
    expect(customAwayPrompt('  Be brief.  ')).toBe('Be brief.')
    expect(customAwayPrompt('x'.repeat(AWAY_PROMPT_MAX_CHARS))).toHaveLength(AWAY_PROMPT_MAX_CHARS)
  })

  it('matches the backend cap', () => {
    expect(AWAY_PROMPT_MAX_CHARS).toBe(6000)
  })
})

describe('awayPromptToSave (what Save stores)', () => {
  it('stores nothing for blank text, so the default keeps applying', () => {
    expect(awayPromptToSave('', DEFAULT)).toBeUndefined()
    expect(awayPromptToSave('   \n', DEFAULT)).toBeUndefined()
  })

  it('stores nothing when the text is the default (even with stray whitespace)', () => {
    expect(awayPromptToSave(DEFAULT, DEFAULT)).toBeUndefined()
    expect(awayPromptToSave(`  ${DEFAULT}\n\n`, DEFAULT)).toBeUndefined()
  })

  it('stores an edited prompt, trimmed', () => {
    expect(awayPromptToSave(`${DEFAULT}\nAlways answer in Hindi.`, DEFAULT)).toBe(`${DEFAULT}\nAlways answer in Hindi.`)
    expect(awayPromptToSave('  A fully custom prompt.  ', DEFAULT)).toBe('A fully custom prompt.')
  })

  it('still works when the default could not be loaded', () => {
    expect(awayPromptToSave('My own prompt.', undefined)).toBe('My own prompt.')
    expect(awayPromptToSave('', undefined)).toBeUndefined()
  })

  it('never stores an oversized prompt', () => {
    expect(awayPromptToSave('x'.repeat(AWAY_PROMPT_MAX_CHARS + 1), DEFAULT)).toBeUndefined()
  })
})

describe('isAwayPromptDirty (unsaved changes guard)', () => {
  it('is false until the user types', () => {
    expect(isAwayPromptDirty(null, DEFAULT)).toBe(false)
  })

  it('ignores whitespace-only differences', () => {
    expect(isAwayPromptDirty(`${DEFAULT}  \n`, DEFAULT)).toBe(false)
  })

  it('is true for a real change, and false again when it is undone', () => {
    expect(isAwayPromptDirty(`${DEFAULT} extra`, DEFAULT)).toBe(true)
    expect(isAwayPromptDirty(DEFAULT, DEFAULT)).toBe(false)
  })

  it('treats clearing a custom prompt as a change', () => {
    expect(isAwayPromptDirty('', 'Custom text')).toBe(true)
  })
})

import { clampAwayTimeout } from '@/config/agentDefaults'

describe('clampAwayTimeout', () => {
  it('raises anything below 4 to 4 and keeps valid values', () => {
    expect(clampAwayTimeout(0)).toBe(4)
    expect(clampAwayTimeout(1.5)).toBe(4)
    expect(clampAwayTimeout(4)).toBe(4)
    expect(clampAwayTimeout(7.5)).toBe(7.5)
  })
  it('treats unset or invalid as off', () => {
    expect(clampAwayTimeout(undefined)).toBeUndefined()
    expect(clampAwayTimeout(null)).toBeUndefined()
    expect(clampAwayTimeout('5')).toBeUndefined()
    expect(clampAwayTimeout(NaN)).toBeUndefined()
  })
})
