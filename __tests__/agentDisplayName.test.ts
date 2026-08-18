import { describe, expect, test } from 'vitest'
import { agentDisplayName, normalizeAgentDisplayName, deriveAgentName, AGENT_DISPLAY_NAME_MAX, AGENT_NAME_PREFIX_MAX } from '@/lib/agentDisplayName'
import { extractAgentIdFromBackendName } from '@/lib/getProjectRoleForApi'

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

describe('deriveAgentName', () => {
  test('takes the first 10 sanitized chars of the label', () => {
    expect(deriveAgentName('Front Desk Riya')).toBe('Front_Desk')
    expect(deriveAgentName('Riya')).toBe('Riya')
  })

  test('output always satisfies the backend agent-name rules', () => {
    const labels = [
      'Front Desk — Riya', 'Clinic 24x7', 'riya', '  padded  ', 'A',
      'Front__Desk', '___Riya', 'Support!!! Desk', 'Ωmega Agent', 'x'.repeat(80),
      '24x7', '★★★', '', '   ', '_', 'Desk_______x',
    ]
    for (const label of labels) {
      const name = deriveAgentName(label)
      expect(name.length, label).toBeGreaterThan(0)
      expect(name.length, label).toBeLessThanOrEqual(AGENT_NAME_PREFIX_MAX)
      // letters/underscores only, starts with a letter, no trailing underscore
      expect(name, label).toMatch(/^[a-zA-Z][a-zA-Z_]*$/)
      expect(name.endsWith('_'), label).toBe(false)
    }
  })

  test('digits are stripped, not rejected', () => {
    expect(deriveAgentName('Clinic 24x7')).toBe('Clinic_x')
    expect(deriveAgentName('24x7')).toBe('x')
  })

  test('labels with no letters fall back to a constant', () => {
    expect(deriveAgentName('★★★')).toBe('agent')
    expect(deriveAgentName('')).toBe('agent')
  })

  test('truncation never leaves a trailing underscore', () => {
    // "Front Desk" is exactly 10 chars and would slice to "Front_Desk";
    // "Front Deskx" slices to "Front_Desk" too — neither may end in _
    expect(deriveAgentName('Front Desk')).toBe('Front_Desk')
    expect(deriveAgentName('Reception Area')).toBe('Reception')
  })

  test('derived name still round-trips through the backend-name parser', () => {
    const id = 'a2e7a0fa-c64c-4840-a063-dad5a3df685e'
    for (const label of ['Front Desk Riya', 'Reception Area', '★★★', 'Clinic 24x7']) {
      const backendName = `${deriveAgentName(label)}_${id.replace(/-/g, '_')}`
      expect(extractAgentIdFromBackendName(backendName), label).toBe(id)
    }
  })
})
