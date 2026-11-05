// Prompt Forge and the agent's tools.
//
// The voice agent gives the LLM more than the custom functions: end call,
// transfer, TTS and language switchers, handoffs and so on are built in. The
// playground needs the same tools, named the same way, or the model can't call
// them and answers in text instead.
import type OpenAI from 'openai'

type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam

export interface BuiltInTool {
  type: string
  name: string
  description: string
  parameters: Array<{ name: string; type: string; description: string; required: boolean }>
}

/** A tool name the way the agent backend sanitizes it. */
export function backendToolName(raw: string): string {
  const name = raw.replaceAll(/[^\w-]/g, '_')
  return /^\d/.test(name) ? `_${name}` : name
}

const tool = (type: string, name: string, description: string, parameters: BuiltInTool['parameters'] = []): BuiltInTool =>
  ({ type, name, description, parameters })

/** One entry of assistant.tools, when it is a built-in tool (custom functions are read elsewhere). */
function builtInFromToolsList(t: any): BuiltInTool | null {
  switch (t?.type) {
    case 'end_call':
      return tool('end_call', 'end_call', 'End the call')
    case 'transfer_call':
      return t.enable_as_tool === false ? null : tool('transfer_call', 'transfer_call', 'Transfer by creating a conference with hospital staff')
    case 'voicemail_detection':
      return tool('voicemail_detection', 'voicemail_detection', 'Call this tool if you have detected a voicemail system, AFTER hearing the voicemail greeting')
    case 'knowledge_search':
      return tool('knowledge_search', 'knowledge_search', 'Search the agent knowledge base for relevant information. Use this when the user asks questions that may be answered by uploaded documents or URLs. Provide a short search query.', [
        { name: 'query', type: 'string', description: 'What to search for', required: true },
      ])
    case 'handoff':
      return t.target_agent ? tool('handoff', `handoff_to_${t.target_agent}`, t.handoff_message || `Hand off to ${t.target_agent}`, [
        { name: 'reason', type: 'string', description: 'Why the call is handed off', required: false },
      ]) : null
    case 'language_switch': {
      const name = backendToolName(t.tool_name || 'switch_language')
      return tool('language_switch', name, t.description || `Switch language to ${t.language_code ?? ''}`.trim())
    }
    default:
      return null
  }
}

/** One entry of assistant.dynamic_tts: a tool that switches the agent's voice. */
function ttsSwitchTool(t: any): BuiltInTool | null {
  if (!t || typeof t !== 'object') return null
  const name = backendToolName(t.tool_name || t.name || 'unknown_tts')
  return tool('tts_switch', name, t.description || `Switch to ${t.name || 'TTS'} voice`)
}

/** The built-in tools a LiveKit agent's assistant config gives its LLM. */
export function builtInAgentTools(assistant: any): BuiltInTool[] {
  const fromTools = (Array.isArray(assistant?.tools) ? assistant.tools : []).map(builtInFromToolsList)
  const fromTts = (Array.isArray(assistant?.dynamic_tts) ? assistant.dynamic_tts : []).map(ttsSwitchTool)
  const seen = new Set<string>()
  return [...fromTools, ...fromTts].filter((t): t is BuiltInTool => {
    if (!t || seen.has(t.name)) return false
    seen.add(t.name)
    return true
  })
}

/** What a built-in tool answers in the playground, where nothing real happens. */
export function builtInToolResult(type: string, name: string): Record<string, string> {
  if (type === 'tts_switch') return { status: 'success', message: `TTS provider switched (${name})` }
  if (type === 'language_switch') return { status: 'success', message: `Language switched (${name})` }
  return { status: 'success', _forge_note: `Tool "${name}" invoked (simulated in Prompt Forge)` }
}

/** A chat message as the playground sends it: text, plus the tools it called. */
export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: Array<{ name: string; arguments?: unknown; result?: unknown }>
}

const asText = (v: unknown, fallback: string) => {
  if (v === undefined || v === null || v === '') return fallback
  return typeof v === 'string' ? v : JSON.stringify(v)
}

/**
 * The conversation in OpenAI chat format, tool calls included: an assistant
 * turn that called tools becomes the call, each result, then what it said.
 * Without this an imported call's TTS switch (or any tool) reaches the model
 * as an empty reply, and the model never learns to call it. Names are cut
 * to 64 characters, as the chat route does for the tools it offers.
 */
export function historyToChatMessages(messages: HistoryMessage[], withTools = true): ChatMessage[] {
  const out: ChatMessage[] = []
  for (const [i, m] of messages.entries()) {
    // without tools in the request, providers refuse tool calls in the history: send the text only
    const calls = withTools && m.role === 'assistant' ? (m.toolCalls ?? []).filter((tc) => tc?.name) : []
    if (calls.length === 0) {
      if (m.content) out.push({ role: m.role, content: m.content })
      continue
    }
    const ids = calls.map((_, j) => `history_${i}_${j}`)
    out.push({
      role: 'assistant',
      content: null,
      tool_calls: calls.map((tc, j) => ({
        id: ids[j],
        type: 'function' as const,
        function: { name: backendToolName(tc.name).slice(0, 64), arguments: asText(tc.arguments, '{}') },
      })),
    })
    for (const [j, tc] of calls.entries()) {
      out.push({ role: 'tool', tool_call_id: ids[j], content: asText(tc.result, '{"status":"success"}') })
    }
    if (m.content) out.push({ role: 'assistant', content: m.content })
  }
  return out
}
