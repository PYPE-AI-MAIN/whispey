// The pure part of Pi's chat streaming: reading the server-sent events, deciding what each one means, and
// updating the message list. Kept out of the component so it can be tested without a browser.

export interface ToolCall {
  id: string
  name: string
  arguments: any
  result?: any
  success?: boolean
  pending?: boolean
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isFinal: boolean
  toolCalls?: ToolCall[]
}

export type ContextUsage = { used: number; limit: number }

export type StreamEvent = {
  text?: string
  error?: string
  toolCall?: { id: string; name: string; arguments: any }
  toolResult?: { id: string; result?: any; success?: boolean }
  sessionId?: string
  usage?: ContextUsage
}

export type ParsedLine = { done: true } | { event: StreamEvent | null } | null

/** One `data: …` line from the stream: the end marker, a JSON event, or null for anything else (including malformed JSON). */
export function parseSseLine(line: string): ParsedLine {
  if (!line.startsWith('data: ')) return null
  const payload = line.slice(6).trim()
  if (payload === '[DONE]') return { done: true }
  try {
    return { event: JSON.parse(payload) }
  } catch {
    return null
  }
}

export type Classified =
  | { kind: 'done' }
  | { kind: 'usage'; usage: ContextUsage }
  | { kind: 'session'; sessionId: string }
  | { kind: 'error'; error: string }
  | { kind: 'text'; text: string }
  | { kind: 'toolCall'; toolCall: NonNullable<StreamEvent['toolCall']> }
  | { kind: 'toolResult'; toolResult: NonNullable<StreamEvent['toolResult']> }
  | { kind: 'ignore' }

/** What an event means. The order matters: an event is only ever one thing, and a session id is only news if we have none yet. */
export function classifyEvent(event: StreamEvent | null, hasSession: boolean): Classified {
  if (!event || typeof event !== 'object') return { kind: 'ignore' }
  const { text, error, toolCall, toolResult, sessionId, usage } = event
  if (usage) return { kind: 'usage', usage }
  if (sessionId && !hasSession) return { kind: 'session', sessionId }
  if (error) return { kind: 'error', error }
  if (text) return { kind: 'text', text }
  if (toolCall) return { kind: 'toolCall', toolCall }
  if (toolResult) return { kind: 'toolResult', toolResult }
  return { kind: 'ignore' }
}

const mapMessage = (messages: Message[], id: string, change: (m: Message) => Message) =>
  messages.map((m) => (m.id === id ? change(m) : m))

/** Replaces a reply with an error line and closes it. */
export const failAssistant = (messages: Message[], id: string, content: string): Message[] =>
  mapMessage(messages, id, (m) => ({ ...m, content, isFinal: true }))

/** Applies one stream event to the reply being written. Events that don't change the messages return the same array. */
export function applyEvent(messages: Message[], assistantId: string, event: Classified): Message[] {
  switch (event.kind) {
    case 'done':
      return mapMessage(messages, assistantId, (m) => ({ ...m, isFinal: true }))
    case 'error':
      return failAssistant(messages, assistantId, event.error)
    case 'text':
      return mapMessage(messages, assistantId, (m) => ({ ...m, content: m.content + event.text }))
    case 'toolCall':
      return mapMessage(messages, assistantId, (m) => ({
        ...m,
        toolCalls: [...(m.toolCalls ?? []), { id: event.toolCall.id, name: event.toolCall.name, arguments: event.toolCall.arguments, pending: true }],
      }))
    case 'toolResult':
      return mapMessage(messages, assistantId, (m) => ({
        ...m,
        toolCalls: (m.toolCalls ?? []).map((tc) =>
          tc.id === event.toolResult.id ? { ...tc, result: event.toolResult.result, success: event.toolResult.success, pending: false } : tc
        ),
      }))
    default:
      return messages
  }
}

/** A page inside this project that a tool result asks the browser to open, or null. Never another project, never an external URL. */
export function navigationTarget(toolResult: { result?: any; success?: boolean }, projectId: string): string | null {
  const href = toolResult.result?.href
  return toolResult.success && typeof href === 'string' && href.startsWith(`/${projectId}/`) ? href : null
}

/** Records the outcome of a Confirm/Cancel click on the tool call it belongs to. */
export function withToolCallResult(messages: Message[], toolCallId: string, result: any, success: boolean): Message[] {
  return messages.map((m) => ({
    ...m,
    toolCalls: m.toolCalls?.map((tc) => (tc.id === toolCallId ? { ...tc, result, success } : tc)),
  }))
}

/** Reads a server-sent-event body to the end, calling `onLine` for every complete line. A trailing partial line is dropped. */
export async function consumeSse(body: ReadableStream<Uint8Array>, onLine: (line: string) => void): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) onLine(line)
  }
}
