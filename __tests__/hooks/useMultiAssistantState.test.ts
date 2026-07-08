import { describe, it, expect } from 'vitest'
import {
  buildAgentEnvelope,
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

describe('custom_function trigger mode serialization', () => {
  const baseTool = (config: any) => ({
    type: 'custom_function',
    name: 'get_weather',
    config: {
      endpoint: 'https://api.example.com/weather',
      method: 'GET',
      parameters: [],
      ...config,
    },
  })

  it.each([
    ['serializeAssistantToolFull', serializeAssistantToolFull],
    ['serializeAssistantToolBasic', serializeAssistantToolBasic],
  ])('%s defaults to tool mode when enableAsTool/enableAsTag are unset', (_label, serialize) => {
    const result: any = serialize(baseTool({}))
    expect(result.enable_as_tool).toBe(true)
    expect(result.enable_as_tag).toBe(false)
  })

  it.each([
    ['serializeAssistantToolFull', serializeAssistantToolFull],
    ['serializeAssistantToolBasic', serializeAssistantToolBasic],
  ])('%s defaults existing tools with no trigger-mode keys to tool mode', (_label, serialize) => {
    // Simulates a tool saved before this feature existed: no enableAsTool/enableAsTag at all.
    const result: any = serialize(baseTool({ enableAsTool: undefined, enableAsTag: undefined }))
    expect(result.enable_as_tool).toBe(true)
    expect(result.enable_as_tag).toBe(false)
  })

  it('replaces the function call with a bare tag for zero-parameter tools', () => {
    const result: any = serializeAssistantToolFull(
      baseTool({ parameters: [], enableAsTool: false, enableAsTag: true })
    )
    expect(result.enable_as_tool).toBe(false)
    expect(result.enable_as_tag).toBe(true)
  })

  it('keeps the tool callable as a backstop for parameterized tools in tag mode', () => {
    const result: any = serializeAssistantToolFull(
      baseTool({
        parameters: [{ name: 'city', type: 'string', description: 'City name', required: true }],
        enableAsTool: true,
        enableAsTag: true,
      })
    )
    expect(result.enable_as_tool).toBe(true)
    expect(result.enable_as_tag).toBe(true)
  })

  it('serializes the rest of the custom_function config alongside trigger-mode flags', () => {
    const result: any = serializeAssistantToolFull(baseTool({ timeout: 15, asyncExecution: true }))
    expect(result).toMatchObject({
      type: 'custom_function',
      name: 'get_weather',
      api_url: 'https://api.example.com/weather',
      http_method: 'GET',
      timeout: 15,
      async: true,
      enable_as_tool: true,
      enable_as_tag: false,
    })
  })
})
