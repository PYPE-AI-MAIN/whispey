import { describe, it, expect } from 'vitest'
import {
  formatNumberLabel,
  getRunningAgentName,
  looksLikePhoneNumber,
  formatDisplayNumber,
  validateDispatch,
  isDispatchDisabled,
  extractDispatchError,
  buildDispatchVariables,
  extractCandidateVariables,
  type DispatchAgent,
  type PhoneNumber,
} from '@/lib/callDispatch'

const phone = (overrides: Partial<PhoneNumber> = {}): PhoneNumber => ({
  id: 'phone-1',
  phone_number: '+919876543210',
  formatted_number: null,
  provider: null,
  trunk_id: 'trunk-1',
  country_code: 'IN',
  status: 'active',
  trunk_direction: 'outbound',
  number_type: null,
  project_id: null,
  project_name: null,
  ...overrides,
})

const agent = (overrides: Partial<DispatchAgent> = {}): DispatchAgent => ({
  id: 'agent-1',
  name: 'sales-bot',
  agent_type: 'pype_agent',
  is_active: true,
  ...overrides,
})

describe('formatNumberLabel', () => {
  it('labels an acefone_bridge number as "bridge"', () => {
    const p = phone({ number_type: 'acefone_bridge', provider: 'acefone', trunk_direction: 'outbound' })
    expect(formatNumberLabel(p)).toBe('+919876543210 (bridge · acefone · outbound)')
  })

  it('labels a plivo_bridge number as "bridge"', () => {
    const p = phone({ number_type: 'plivo_bridge' })
    expect(formatNumberLabel(p)).toContain('bridge')
  })

  it('labels any other number_type as "SIP"', () => {
    const p = phone({ number_type: 'sip_trunk', provider: null, trunk_direction: null as any })
    expect(formatNumberLabel(p)).toBe('+919876543210 (SIP)')
  })

  it('prefers formatted_number over phone_number when present', () => {
    const p = phone({ formatted_number: '+91 98765 43210' })
    expect(formatNumberLabel(p)).toContain('+91 98765 43210')
  })

  it('drops empty provider/direction from the parenthetical instead of showing blank separators', () => {
    const p = phone({ provider: null, trunk_direction: null as any })
    expect(formatNumberLabel(p)).toBe('+919876543210 (SIP)')
  })
})

describe('getRunningAgentName', () => {
  it('reports not-running for a non-pype_agent regardless of runningAgents', () => {
    const a = agent({ agent_type: 'vapi' })
    expect(getRunningAgentName(a, [{ agent_name: 'sales-bot', pid: 1, status: 'running' }])).toEqual({
      isRunning: false,
      agentName: null,
    })
  })

  it('reports not-running when there are no running agents at all', () => {
    expect(getRunningAgentName(agent(), [])).toEqual({ isRunning: false, agentName: null })
  })

  it('matches the new `{name}_{sanitized-id}` format', () => {
    const a = agent({ id: 'abc-123', name: 'sales-bot' })
    const running = [{ agent_name: 'sales-bot_abc_123', pid: 1, status: 'running' }]
    expect(getRunningAgentName(a, running)).toEqual({ isRunning: true, agentName: 'sales-bot_abc_123' })
  })

  it('falls back to matching the bare agent name (old format)', () => {
    const running = [{ agent_name: 'sales-bot', pid: 1, status: 'running' }]
    expect(getRunningAgentName(agent(), running)).toEqual({ isRunning: true, agentName: 'sales-bot' })
  })

  it('reports not-running when no entry matches either format', () => {
    const running = [{ agent_name: 'some-other-bot', pid: 1, status: 'running' }]
    expect(getRunningAgentName(agent(), running)).toEqual({ isRunning: false, agentName: null })
  })
})

describe('looksLikePhoneNumber', () => {
  it('rejects a value with fewer than 8 digits', () => {
    expect(looksLikePhoneNumber('1234567')).toBe(false)
  })

  it('accepts a value with exactly 8 digits', () => {
    expect(looksLikePhoneNumber('12345678')).toBe(true)
  })

  it('accepts a value with exactly 15 digits', () => {
    expect(looksLikePhoneNumber('123456789012345')).toBe(true)
  })

  it('rejects a value with more than 15 digits (the production garbled-number case)', () => {
    expect(looksLikePhoneNumber('1'.repeat(45))).toBe(false)
  })

  it('ignores non-digit formatting characters when counting', () => {
    expect(looksLikePhoneNumber('+91 (987) 654-3210')).toBe(true)
  })
})

describe('formatDisplayNumber', () => {
  it('returns short values unchanged', () => {
    expect(formatDisplayNumber('9876543210')).toBe('9876543210')
  })

  it('truncates values longer than the max length and adds an ellipsis', () => {
    const garbled = '1'.repeat(45)
    const result = formatDisplayNumber(garbled)
    expect(result).toBe(`${'1'.repeat(20)}…`)
  })

  it('respects a custom maxLength', () => {
    expect(formatDisplayNumber('123456789', 5)).toBe('12345…')
  })
})

describe('validateDispatch', () => {
  const running = { isRunning: true, agentName: 'sales-bot' }

  it('silently no-ops (error: null) when there is no agent selected', () => {
    expect(validateDispatch(false, '9876543210', 'phone-1', [phone()], running)).toEqual({ ok: false, error: null })
  })

  it('silently no-ops when the phone number field is empty', () => {
    expect(validateDispatch(true, '   ', 'phone-1', [phone()], running)).toEqual({ ok: false, error: null })
  })

  it('rejects a phone number that is too short', () => {
    const result = validateDispatch(true, '123', 'phone-1', [phone()], running)
    expect(result).toEqual({ ok: false, error: 'Please enter a valid phone number' })
  })

  it('rejects a phone number that is too long (garbled production value)', () => {
    const result = validateDispatch(true, '1'.repeat(45), 'phone-1', [phone()], running)
    expect(result).toEqual({ ok: false, error: 'Please enter a valid phone number' })
  })

  it('requires a from-number to be selected', () => {
    const result = validateDispatch(true, '9876543210', '', [phone()], running)
    expect(result).toEqual({ ok: false, error: 'Please select a phone number to call from' })
  })

  it('errors when the selected from-number id does not match any known number', () => {
    const result = validateDispatch(true, '9876543210', 'missing-id', [phone()], running)
    expect(result).toEqual({ ok: false, error: 'Selected phone number not found' })
  })

  it('requires a trunk_id for a non-bridge number', () => {
    const p = phone({ trunk_id: null })
    const result = validateDispatch(true, '9876543210', p.id, [p], running)
    expect(result).toEqual({ ok: false, error: 'Selected phone number is missing trunk ID' })
  })

  it('does not require a trunk_id for an acefone_bridge number', () => {
    const p = phone({ trunk_id: null, number_type: 'acefone_bridge' })
    const result = validateDispatch(true, '9876543210', p.id, [p], running)
    expect(result.ok).toBe(true)
  })

  it('does not require a trunk_id for a plivo_bridge number', () => {
    const p = phone({ trunk_id: null, number_type: 'plivo_bridge' })
    const result = validateDispatch(true, '9876543210', p.id, [p], running)
    expect(result.ok).toBe(true)
  })

  it('rejects dispatch when the agent is not currently running', () => {
    const p = phone()
    const result = validateDispatch(true, '9876543210', p.id, [p], { isRunning: false, agentName: null })
    expect(result).toEqual({ ok: false, error: 'Agent is not currently running. Please start the agent first.' })
  })

  it('rejects dispatch when isRunning is true but agentName is missing', () => {
    const p = phone()
    const result = validateDispatch(true, '9876543210', p.id, [p], { isRunning: true, agentName: null })
    expect(result.ok).toBe(false)
  })

  it('succeeds and returns the cleaned number + selected phone + agent name', () => {
    const p = phone()
    const result = validateDispatch(true, '+91 98765-43210', p.id, [p], running)
    expect(result).toEqual({ ok: true, cleaned: '919876543210', selectedPhone: p, agentName: 'sales-bot' })
  })
})

describe('isDispatchDisabled', () => {
  const runningStatus = { isRunning: true, agentName: 'sales-bot' }

  it('disables while a dispatch is already loading', () => {
    expect(isDispatchDisabled(agent(), runningStatus, false, true, '9876543210', 'phone-1')).toBe(true)
  })

  it('disables when the phone number is empty', () => {
    expect(isDispatchDisabled(agent(), runningStatus, false, false, '  ', 'phone-1')).toBe(true)
  })

  it('disables when no from-number is selected', () => {
    expect(isDispatchDisabled(agent(), runningStatus, false, false, '9876543210', '  ')).toBe(true)
  })

  it('disables while still checking whether the agent is running', () => {
    expect(isDispatchDisabled(agent(), runningStatus, true, false, '9876543210', 'phone-1')).toBe(true)
  })

  it('disables a pype_agent that is not currently running', () => {
    const notRunning = { isRunning: false, agentName: null }
    expect(isDispatchDisabled(agent(), notRunning, false, false, '9876543210', 'phone-1')).toBe(true)
  })

  it('enables a pype_agent that is currently running', () => {
    expect(isDispatchDisabled(agent(), runningStatus, false, false, '9876543210', 'phone-1')).toBe(false)
  })

  it('disables a non-pype_agent that is inactive', () => {
    const a = agent({ agent_type: 'vapi', is_active: false })
    expect(isDispatchDisabled(a, runningStatus, false, false, '9876543210', 'phone-1')).toBe(true)
  })

  it('enables a non-pype_agent that is active (running-status is irrelevant for it)', () => {
    const a = agent({ agent_type: 'vapi', is_active: true })
    expect(isDispatchDisabled(a, { isRunning: false, agentName: null }, false, false, '9876543210', 'phone-1')).toBe(false)
  })
})

describe('extractDispatchError', () => {
  it('formats a 429 without current_calls as a generic rate-limit message', () => {
    expect(extractDispatchError({}, 429)).toBe('Rate limit exceeded. Please try again later.')
  })

  it('formats a 429 with current_calls/max_calls into a specific message', () => {
    const result = extractDispatchError({ current_calls: 10, max_calls: 10 }, 429)
    expect(result).toBe('Rate limit exceeded. Current calls: 10/10. Please try again later.')
  })

  it('uses a string `error` field directly', () => {
    expect(extractDispatchError({ error: 'Agent not found' }, 400)).toBe('Agent not found')
  })

  it('uses `error.message` when `error` is an object', () => {
    expect(extractDispatchError({ error: { message: 'Invalid trunk' } }, 400)).toBe('Invalid trunk')
  })

  it('uses a string `message` field as a last resort', () => {
    expect(extractDispatchError({ message: 'Something went wrong' }, 500)).toBe('Something went wrong')
  })

  it('falls back to a generic message when nothing usable is present', () => {
    expect(extractDispatchError({}, 500)).toBe('Failed to dispatch call')
  })
})

describe('buildDispatchVariables', () => {
  it('builds a plain object keyed by the (trimmed) variable name', () => {
    const result = buildDispatchVariables([{ key: ' customer_name ', value: 'Priya' }])
    expect(result).toEqual({ customer_name: 'Priya' })
  })

  it('drops entries whose key is empty or only whitespace', () => {
    const result = buildDispatchVariables([
      { key: '', value: 'ignored' },
      { key: '   ', value: 'ignored' },
      { key: 'valid', value: 'kept' },
    ])
    expect(result).toEqual({ valid: 'kept' })
  })

  it('returns an empty object for an empty list', () => {
    expect(buildDispatchVariables([])).toEqual({})
  })
})

describe('extractCandidateVariables', () => {
  it('returns an empty object for null/undefined metadata', () => {
    expect(extractCandidateVariables(null)).toEqual({})
    expect(extractCandidateVariables(undefined)).toEqual({})
  })

  it('returns an empty object when metadata is not an object', () => {
    expect(extractCandidateVariables('a string')).toEqual({})
    expect(extractCandidateVariables(42)).toEqual({})
  })

  it('returns an empty object when metadata is an array', () => {
    expect(extractCandidateVariables(['a', 'b'])).toEqual({})
  })

  it('keeps flat string/number/boolean fields, stringified', () => {
    const result = extractCandidateVariables({ name: 'Priya', age: 30, verified: true })
    expect(result).toEqual({ name: 'Priya', age: '30', verified: 'true' })
  })

  it('drops nested objects and arrays (structural blobs like complete_configuration)', () => {
    const result = extractCandidateVariables({
      name: 'Priya',
      complete_configuration: { nested: true },
      context_memory_turns: [1, 2, 3],
    })
    expect(result).toEqual({ name: 'Priya' })
  })
})
