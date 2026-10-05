/**
 * The one piece of QA that edits a live agent's prompt.
 *
 * The behaviour that matters most here is the refusal: when the prompt has
 * moved on since the suggestion was written, nothing may change. Silently
 * editing the wrong line of a production prompt is worse than doing nothing.
 */
import { describe, it, expect } from 'vitest'
import { applyPatch, readPrompt, writePrompt } from '@/server/qa/applyPatch'

const PROMPT = [
  'You are Anjali, calling to confirm appointments.',
  '',
  'Greet the patient by name.',
  'Would you like to reschedule your appointment?',
  'Close politely.',
].join('\n')

describe('applyPatch — replacing lines', () => {
  it('replaces a line in place', () => {
    const { prompt, conflicts } = applyPatch(
      PROMPT,
      ['Would you like to reschedule your appointment?'],
      ['Confirm the appointment first.', 'Only then offer to move it.'],
    )
    expect(conflicts).toEqual([])
    expect(prompt).toContain('Confirm the appointment first.')
    expect(prompt).toContain('Only then offer to move it.')
    expect(prompt).not.toContain('Would you like to reschedule')
    // the rest of the prompt is untouched
    expect(prompt).toContain('Greet the patient by name.')
    expect(prompt).toContain('Close politely.')
  })

  it('puts the new lines where the old one was, not at the end', () => {
    const { prompt } = applyPatch(PROMPT, ['Greet the patient by name.'], ['Verify who is speaking.'])
    const lines = prompt.split('\n')
    expect(lines.indexOf('Verify who is speaking.')).toBeLessThan(lines.indexOf('Close politely.'))
  })

  it('ignores whitespace differences when matching', () => {
    const { prompt, conflicts } = applyPatch(
      PROMPT,
      ['   Would   you like to reschedule your appointment?  '],
      ['Replaced.'],
    )
    expect(conflicts).toEqual([])
    expect(prompt).toContain('Replaced.')
  })

  it('removes several lines but inserts once, at the first', () => {
    const { prompt, conflicts } = applyPatch(
      PROMPT,
      ['Greet the patient by name.', 'Would you like to reschedule your appointment?'],
      ['One combined instruction.'],
    )
    expect(conflicts).toEqual([])
    expect(prompt.match(/One combined instruction\./g)).toHaveLength(1)
    expect(prompt).not.toContain('Greet the patient by name.')
    expect(prompt).not.toContain('Would you like to reschedule')
  })
})

describe('applyPatch — refusing when the prompt has drifted', () => {
  it('changes nothing and reports the line it could not find', () => {
    const { prompt, conflicts } = applyPatch(PROMPT, ['A line that is not there'], ['Something new'])
    expect(conflicts).toEqual(['A line that is not there'])
    expect(prompt).toBe(PROMPT)
  })

  it('refuses the whole patch when only one of several lines is missing', () => {
    const { prompt, conflicts } = applyPatch(
      PROMPT,
      ['Greet the patient by name.', 'A line that is not there'],
      ['Something new'],
    )
    // partial application would be the dangerous outcome
    expect(conflicts).toEqual(['A line that is not there'])
    expect(prompt).toBe(PROMPT)
    expect(prompt).toContain('Greet the patient by name.')
  })

  it('does not match the same line twice', () => {
    const doubled = 'Say hello.\nSay hello.\nDone.'
    const { prompt, conflicts } = applyPatch(doubled, ['Say hello.', 'Say hello.'], ['Say hi once.'])
    expect(conflicts).toEqual([])
    expect(prompt).toBe('Say hi once.\nDone.')
  })
})

describe('applyPatch — pure additions', () => {
  it('appends when there is nothing to remove', () => {
    const { prompt, conflicts } = applyPatch(PROMPT, [], ['If the patient does not remember booking, offer a callback.'])
    expect(conflicts).toEqual([])
    expect(prompt.startsWith(PROMPT.trimEnd())).toBe(true)
    expect(prompt).toContain('offer a callback')
  })

  it('an empty patch leaves the prompt alone', () => {
    expect(applyPatch(PROMPT, [], []).prompt).toBe(PROMPT)
  })
})

describe('readPrompt / writePrompt', () => {
  it('reads the assistant shape', () => {
    const config = { agent: { assistant: [{ prompt: 'hello' }] } }
    expect(readPrompt(config)).toEqual({ prompt: 'hello', path: 'assistant' })
  })

  it('reads the flat agent shape', () => {
    expect(readPrompt({ agent: { prompt: 'hello' } })).toEqual({ prompt: 'hello', path: 'agent' })
  })

  it('returns null when there is no prompt to edit', () => {
    expect(readPrompt({ agent: {} })).toBeNull()
    expect(readPrompt(null)).toBeNull()
    expect(readPrompt({})).toBeNull()
  })

  it('writes without mutating the original config', () => {
    const config = { agent: { assistant: [{ prompt: 'old' }], name: 'Anjali' } }
    const next = writePrompt(config, 'assistant', 'new')
    expect(next.agent.assistant[0].prompt).toBe('new')
    expect(config.agent.assistant[0].prompt).toBe('old')
    expect(next.agent.name).toBe('Anjali')
  })
})
