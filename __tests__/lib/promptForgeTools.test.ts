import { describe, expect, it } from 'vitest'
import { backendToolName, builtInAgentTools, historyToChatMessages } from '@/lib/promptForgeTools'

describe('builtInAgentTools', () => {
  const assistant = {
    tools: [
      { type: 'custom_function', name: 'book_slot', api_url: 'https://x' },
      { type: 'end_call' },
      { type: 'transfer_call', enable_as_tool: false },
      { type: 'handoff', target_agent: 'billing' },
      { type: 'language_switch', tool_name: 'switch to hindi', language_code: 'hi' },
    ],
    dynamic_tts: [{ name: 'ElevenLabs Hindi', description: 'Use for Hindi' }, { tool_name: '11labs' }],
  }
  const tools = builtInAgentTools(assistant)

  it('names tools the way the agent backend does', () => {
    expect(tools.map((t) => t.name)).toEqual(['end_call', 'handoff_to_billing', 'switch_to_hindi', 'ElevenLabs_Hindi', '_11labs'])
  })
  it('includes the TTS switchers with their description', () => {
    expect(tools.find((t) => t.type === 'tts_switch')?.description).toBe('Use for Hindi')
  })
  it('leaves out custom functions and transfer when it is not a tool', () => {
    expect(tools.some((t) => t.name === 'book_slot' || t.name === 'transfer_call')).toBe(false)
  })
  it('handles an assistant without tools', () => {
    expect(builtInAgentTools(null)).toEqual([])
  })
})

describe('backendToolName', () => {
  it.each([['a b-c', 'a_b-c'], ['9x', '_9x'], ['ok', 'ok']])('%s → %s', (raw, name) => {
    expect(backendToolName(raw)).toBe(name)
  })
})

describe('historyToChatMessages', () => {
  const history = [
    { role: 'user' as const, content: 'Hindi please' },
    { role: 'assistant' as const, content: '', toolCalls: [{ name: 'ElevenLabs Hindi', arguments: {}, result: { status: 'success' } }] },
    { role: 'assistant' as const, content: 'Ji, boliye' },
  ]

  it('keeps tool calls with their results', () => {
    expect(historyToChatMessages(history)).toEqual([
      { role: 'user', content: 'Hindi please' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'history_1_0', type: 'function', function: { name: 'ElevenLabs_Hindi', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'history_1_0', content: '{"status":"success"}' },
      { role: 'assistant', content: 'Ji, boliye' },
    ])
  })
  it('sends text only when the request has no tools', () => {
    expect(historyToChatMessages(history, false)).toEqual([
      { role: 'user', content: 'Hindi please' },
      { role: 'assistant', content: 'Ji, boliye' },
    ])
  })
})
