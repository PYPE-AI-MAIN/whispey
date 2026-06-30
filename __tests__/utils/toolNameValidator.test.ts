import { describe, it, expect } from 'vitest'
import { validateToolName } from '@/components/agents/AgentConfig/AgentAdvancedSettings/ConfigParents/ToolsActionsSettingsProps'
import { validate } from '@/components/agents/AgentConfig/LanguageSwitchSettings'

// ── validateToolName ──────────────────────────────────────────────────────────

describe('validateToolName', () => {
  it('returns null for a valid snake_case name', () => {
    expect(validateToolName('transfer_call', [])).toBeNull()
  })

  it('returns null for name with digits', () => {
    expect(validateToolName('tool_v2', [])).toBeNull()
  })

  it('errors on empty name', () => {
    expect(validateToolName('', [])).toBe('Tool name is required')
  })

  it('errors when name exceeds 30 characters', () => {
    expect(validateToolName('a'.repeat(31), [])).toBe('Tool name must be 30 characters or less')
  })

  it('accepts exactly 30 characters', () => {
    expect(validateToolName('a'.repeat(30), [])).toBeNull()
  })

  it('errors on uppercase letters', () => {
    expect(validateToolName('TransferCall', [])).toMatch(/snake_case/)
  })

  it('errors on spaces', () => {
    expect(validateToolName('transfer call', [])).toMatch(/snake_case/)
  })

  it('errors on special characters', () => {
    expect(validateToolName('transfer-call', [])).toMatch(/snake_case/)
    expect(validateToolName('transfer.call', [])).toMatch(/snake_case/)
  })

  it('errors when name starts with a digit', () => {
    expect(validateToolName('1_tool', [])).toMatch(/snake_case/)
  })

  it('errors on duplicate name', () => {
    expect(validateToolName('end_call', ['end_call', 'transfer_call'])).toBe('"end_call" tool already exists')
  })

  it('returns null when name matches excluded current name', () => {
    // current name is excluded from the allNames list by the caller
    expect(validateToolName('end_call', ['transfer_call'])).toBeNull()
  })
})

// ── LanguageSwitchSettings validate ──────────────────────────────────────────

const baseSTT = { name: 'sarvam' as const, language: 'kn-IN', model: 'saaras:v3' }
const baseTTS = { name: 'sarvam' }

const makeEntry = (overrides = {}) => ({
  tool_name: 'switch_to_kn',
  description: 'Switch to Kannada when user speaks in Kannada',
  language_code: 'kn-IN',
  system_message: 'Respond in Kannada.',
  allow_interruptions: true,
  interruption: true,
  switch_stt: true,
  switch_tts: true,
  stt: baseSTT,
  tts: baseTTS,
  ...overrides,
})

describe('LanguageSwitchSettings validate', () => {
  it('returns no errors for a valid entry', () => {
    expect(validate(makeEntry(), [], null)).toEqual({})
  })

  it('errors when tool_name is empty', () => {
    const e = validate(makeEntry({ tool_name: '' }), [], null)
    expect(e.tool_name).toBe('Required')
  })

  it('errors when tool_name exceeds 30 characters', () => {
    const e = validate(makeEntry({ tool_name: 'a'.repeat(31) }), [], null)
    expect(e.tool_name).toMatch(/30 characters/)
  })

  it('errors when tool_name is not snake_case', () => {
    const e = validate(makeEntry({ tool_name: 'Switch To Kn' }), [], null)
    expect(e.tool_name).toMatch(/snake_case/)
  })

  it('errors on duplicate tool_name within entries', () => {
    const existing = makeEntry({ tool_name: 'switch_to_kn' })
    const e = validate(makeEntry({ tool_name: 'switch_to_kn' }), [existing], null)
    expect(e.tool_name).toMatch(/already exists/)
  })

  it('does not flag duplicate when editing same index', () => {
    const existing = makeEntry({ tool_name: 'switch_to_kn' })
    const e = validate(makeEntry({ tool_name: 'switch_to_kn' }), [existing], 0)
    expect(e.tool_name).toBeUndefined()
  })

  it('errors when tool_name collides with existingToolNames from other tools', () => {
    const e = validate(makeEntry({ tool_name: 'end_call' }), [], null, ['end_call', 'transfer_call'])
    expect(e.tool_name).toMatch(/already exists/)
  })

  it('errors when description is too short', () => {
    const e = validate(makeEntry({ description: 'Too short' }), [], null)
    expect(e.description).toMatch(/10/)
  })

  it('errors when system_message is empty', () => {
    const e = validate(makeEntry({ system_message: '' }), [], null)
    expect(e.system_message).toBeTruthy()
  })

  it('errors when tts provider is not set', () => {
    const e = validate(makeEntry({ tts: {} }), [], null)
    expect(e.tts).toBeTruthy()
  })
})
