import { describe, it, expect } from 'vitest'
import {
  hasStudioSecret,
  slugifyAgentName,
  studioUrl,
  voiceRefError,
  applyAssistantUpdates,
} from '@/lib/mcpAgentHelpers'

describe('hasStudioSecret', () => {
  it('accepts only the exact configured secret', () => {
    expect(hasStudioSecret('s3cret', 's3cret')).toBe(true)
  })

  it('rejects a wrong secret, including one of a different length', () => {
    expect(hasStudioSecret('s3cret!', 's3cret')).toBe(false)
    expect(hasStudioSecret('wrong-1', 's3cret')).toBe(false)
  })

  it('rejects a missing header or an unconfigured server secret', () => {
    expect(hasStudioSecret(null, 's3cret')).toBe(false)
    expect(hasStudioSecret('s3cret', undefined)).toBe(false)
    expect(hasStudioSecret('', '')).toBe(false)
  })
})

describe('slugifyAgentName', () => {
  it('lowercases and joins words with single underscores', () => {
    expect(slugifyAgentName('Post-Discharge  Follow Up!')).toBe('post_discharge_follow_up')
  })

  it('strips leading and trailing separators', () => {
    expect(slugifyAgentName('  --Hello World--  ')).toBe('hello_world')
  })

  it('caps the length at 40 characters', () => {
    expect(slugifyAgentName('a'.repeat(80))).toHaveLength(40)
  })

  it('falls back to "agent" when nothing usable is left', () => {
    expect(slugifyAgentName('!!!')).toBe('agent')
    expect(slugifyAgentName('')).toBe('agent')
  })
})

describe('studioUrl', () => {
  it('builds the Studio path under the app URL', () => {
    expect(studioUrl('p1', 'a1', 'https://app.example.com')).toBe('https://app.example.com/p1/agents/a1/studio')
  })

  it('ignores a trailing slash on the app URL', () => {
    expect(studioUrl('p1', 'a1', 'https://app.example.com/')).toBe('https://app.example.com/p1/agents/a1/studio')
  })

  it('defaults to localhost when no app URL is configured', () => {
    expect(studioUrl('p1', 'a1')).toBe('http://localhost:3000/p1/agents/a1/studio')
  })
})

describe('voiceRefError', () => {
  it('requires both provider and voice_id', () => {
    expect(voiceRefError(undefined)).toBe('voice requires provider and voice_id')
    expect(voiceRefError({ provider: 'sarvam' })).toBe('voice requires provider and voice_id')
    expect(voiceRefError({ voice_id: 'x' })).toBe('voice requires provider and voice_id')
  })

  it('accepts a complete voice', () => {
    expect(voiceRefError({ provider: 'sarvam', voice_id: 'kavya' })).toBeNull()
  })
})

describe('applyAssistantUpdates', () => {
  const current = {
    name: 'agent',
    prompt: 'old prompt',
    tts: { name: 'elevenlabs', voice_id: 'old' },
    variables: { a: '1', b: '2' },
    first_message_mode: { mode: 'user_speaks_first', allow_interruptions: true },
    stt: { name: 'x' },
  }

  it('leaves everything untouched when no updates are given', () => {
    expect(applyAssistantUpdates(current, {})).toEqual(current)
  })

  it('does not mutate the assistant it was given', () => {
    const copy = structuredClone(current)
    applyAssistantUpdates(current, { prompt: 'new', variables: { a: '9' } })
    expect(current).toEqual(copy)
  })

  it('replaces the prompt', () => {
    expect(applyAssistantUpdates(current, { prompt: 'new' }).prompt).toBe('new')
  })

  it('sets the greeting while keeping the other first-message settings', () => {
    const next = applyAssistantUpdates(current, { greeting: 'Hello!' })
    expect(next.first_message_mode).toEqual({
      mode: 'assistant_speaks_first',
      first_message: 'Hello!',
      allow_interruptions: true,
    })
  })

  it('sets the greeting when the assistant has no first-message settings yet', () => {
    const next = applyAssistantUpdates({ name: 'agent' }, { greeting: 'Hi' })
    expect(next.first_message_mode).toEqual({ mode: 'assistant_speaks_first', first_message: 'Hi' })
  })

  it('fully replaces the tts config rather than merging it', () => {
    const tts = { name: 'sarvam', speaker: 'kavya' }
    expect(applyAssistantUpdates(current, { tts }).tts).toEqual(tts)
  })

  it('merges variables into the existing ones', () => {
    expect(applyAssistantUpdates(current, { variables: { b: '9', c: '3' } }).variables).toEqual({
      a: '1',
      b: '9',
      c: '3',
    })
  })

  it('creates the variables object when the assistant had none', () => {
    expect(applyAssistantUpdates({ name: 'agent' }, { variables: { a: '1' } }).variables).toEqual({ a: '1' })
  })

  it('never touches fields it was not asked to change', () => {
    const next = applyAssistantUpdates(current, { prompt: 'new' })
    expect(next.stt).toEqual(current.stt)
    expect(next.tts).toEqual(current.tts)
  })
})
