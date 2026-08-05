import { describe, it, expect } from 'vitest'
import {
  buildAgentEnvelope,
  serializeVoicemailDetectionTool,
  serializeAssistantToolFull,
  serializeAssistantToolBasic,
} from '@/hooks/useMultiAssistantState'

describe('buildAgentEnvelope', () => {
  it('includes agent_id when provided', () => {
    const result = buildAgentEnvelope('My Agent', 'livekit', [{ prompt: 'hi' }], 'agent-123')
    expect(result).toEqual({
      agent: { name: 'My Agent', type: 'livekit', agent_id: 'agent-123', assistant: [{ prompt: 'hi' }] }
    })
  })

  it('omits agent_id when not provided', () => {
    const result = buildAgentEnvelope('My Agent', 'livekit', [{ prompt: 'hi' }])
    expect(result).toEqual({
      agent: { name: 'My Agent', type: 'livekit', assistant: [{ prompt: 'hi' }] }
    })
    expect(result.agent).not.toHaveProperty('agent_id')
  })

  it('passes multiple assistants as-is', () => {
    const assistants = [{ prompt: 'a' }, { prompt: 'b' }]
    const result = buildAgentEnvelope('Agent', 'pipecat', assistants)
    expect(result.agent.assistant).toHaveLength(2)
  })
})

describe('serializeVoicemailDetectionTool', () => {
  const baseToolConfig = { type: 'voicemail_detection' }
  const commonFields = { name: 'Voicemail Detection', description: 'Detects voicemail' }

  it('includes vm_message and vm_wait_timeout from tool.config', () => {
    const tool = { config: { vm_message: 'Call back later', vm_wait_timeout: 12 } }
    const result = serializeVoicemailDetectionTool(tool, baseToolConfig, commonFields)
    expect(result).toEqual({
      type: 'voicemail_detection',
      name: 'Voicemail Detection',
      description: 'Detects voicemail',
      vm_message: 'Call back later',
      vm_wait_timeout: 12,
    })
  })

  it('falls back to real defaults when config fields are absent', () => {
    const tool = { config: {} }
    const result = serializeVoicemailDetectionTool(tool, baseToolConfig, commonFields)
    expect(result.vm_message).toMatch(/reached a voicemail/)
    expect(result.vm_wait_timeout).toBe(7)
  })

  it('preserves a blank vm_message instead of falling back to the default (?? not ||)', () => {
    const tool = { config: { vm_message: '', vm_wait_timeout: 12 } }
    const result = serializeVoicemailDetectionTool(tool, baseToolConfig, commonFields)
    expect(result.vm_message).toBe('')
  })

  it('preserves a 0 vm_wait_timeout instead of falling back to the default (?? not ||)', () => {
    const tool = { config: { vm_message: 'Bye', vm_wait_timeout: 0 } }
    const result = serializeVoicemailDetectionTool(tool, baseToolConfig, commonFields)
    expect(result.vm_wait_timeout).toBe(0)
  })
})

describe('serializeAssistantToolFull / serializeAssistantToolBasic — voicemail_detection', () => {
  // Regression test: these dispatchers had no case for voicemail_detection at
  // all, so saving silently reduced it to just {type: 'voicemail_detection'},
  // dropping name/description/vm_message/vm_wait_timeout on every agent update.
  const tool = {
    type: 'voicemail_detection',
    name: 'Voicemail Detection',
    config: { description: 'Detects voicemail', vm_message: 'Please call back', vm_wait_timeout: 5 },
  }

  it('serializeAssistantToolFull preserves the full voicemail_detection config', () => {
    const result = serializeAssistantToolFull(tool)
    expect(result).toEqual({
      type: 'voicemail_detection',
      name: 'Voicemail Detection',
      description: 'Detects voicemail',
      vm_message: 'Please call back',
      vm_wait_timeout: 5,
    })
  })

  it('serializeAssistantToolBasic preserves the full voicemail_detection config', () => {
    const result = serializeAssistantToolBasic(tool)
    expect(result).toEqual({
      type: 'voicemail_detection',
      name: 'Voicemail Detection',
      description: 'Detects voicemail',
      vm_message: 'Please call back',
      vm_wait_timeout: 5,
    })
  })

  it('does not reduce to just {type} the way the unfixed fallthrough did', () => {
    const result = serializeAssistantToolFull(tool)
    expect(Object.keys(result).sort()).not.toEqual(['type'])
    expect(result).toHaveProperty('vm_message')
    expect(result).toHaveProperty('vm_wait_timeout')
  })
})
