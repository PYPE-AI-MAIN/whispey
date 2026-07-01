import { describe, it, expect } from 'vitest'
import { buildAgentEnvelope } from '@/hooks/useMultiAssistantState'

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
