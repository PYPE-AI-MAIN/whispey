import { describe, expect, test } from 'vitest'
import { agentDisplayName, normalizeAgentDisplayName, AGENT_DISPLAY_NAME_MAX } from '@/lib/agentDisplayName'

describe('agentDisplayName', () => {
  test('falls back to name when there is no override', () => {
    expect(agentDisplayName({ name: 'Riya' })).toBe('Riya')
    expect(agentDisplayName({ name: 'Riya', display_name: null })).toBe('Riya')
    expect(agentDisplayName({ name: 'Riya', display_name: '   ' })).toBe('Riya')
  })

  test('prefers the override', () => {
    expect(agentDisplayName({ name: 'Riya', display_name: 'Front Desk — Riya' })).toBe('Front Desk — Riya')
  })

  test('never throws on missing agent', () => {
    expect(agentDisplayName(null)).toBe('')
    expect(agentDisplayName(undefined)).toBe('')
    expect(agentDisplayName({})).toBe('')
  })
})

describe('normalizeAgentDisplayName', () => {
  test('blank input clears the override', () => {
    expect(normalizeAgentDisplayName('')).toBeNull()
    expect(normalizeAgentDisplayName('   ')).toBeNull()
    expect(normalizeAgentDisplayName(null)).toBeNull()
    expect(normalizeAgentDisplayName(undefined)).toBeNull()
  })

  test('trims', () => {
    expect(normalizeAgentDisplayName('  Front Desk  ')).toBe('Front Desk')
  })

  test('rejects non-strings and overlong values', () => {
    expect(() => normalizeAgentDisplayName(42)).toThrow()
    expect(() => normalizeAgentDisplayName('x'.repeat(AGENT_DISPLAY_NAME_MAX + 1))).toThrow()
    expect(normalizeAgentDisplayName('x'.repeat(AGENT_DISPLAY_NAME_MAX))).toHaveLength(AGENT_DISPLAY_NAME_MAX)
  })
})
