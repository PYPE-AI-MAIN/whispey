import { describe, it, expect, vi } from 'vitest'
import {
  applyEvent, classifyEvent, consumeSse, failAssistant, navigationTarget, parseSseLine, withToolCallResult,
  type Message,
} from '@/lib/piStream'

const reply = (over: Partial<Message> = {}): Message => ({ id: 'a1', role: 'assistant', content: '', isFinal: false, toolCalls: [], ...over })
const user: Message = { id: 'u1', role: 'user', content: 'hi', isFinal: true }

describe('parseSseLine', () => {
  it('reads data lines, the end marker, and ignores everything else', () => {
    expect(parseSseLine('data: {"text":"hi"}')).toEqual({ event: { text: 'hi' } })
    expect(parseSseLine('data:   {"text":"hi"}  ')).toEqual({ event: { text: 'hi' } }) // extra spaces after the prefix are trimmed
    expect(parseSseLine('data:{"text":"hi"}')).toBeNull() // but the prefix itself is exactly "data: "
    expect(parseSseLine('data: [DONE]')).toEqual({ done: true })
    expect(parseSseLine('data:  [DONE] ')).toEqual({ done: true })
    expect(parseSseLine(': keep-alive')).toBeNull()
    expect(parseSseLine('')).toBeNull()
  })
  it('treats malformed JSON as nothing instead of failing the stream', () => {
    expect(parseSseLine('data: {not json')).toBeNull()
    expect(parseSseLine('data: ')).toBeNull()
  })
})

describe('classifyEvent', () => {
  it('maps each event to one meaning', () => {
    expect(classifyEvent({ usage: { used: 5, limit: 10 } }, true)).toEqual({ kind: 'usage', usage: { used: 5, limit: 10 } })
    expect(classifyEvent({ sessionId: 's1' }, false)).toEqual({ kind: 'session', sessionId: 's1' })
    expect(classifyEvent({ error: 'boom' }, true)).toEqual({ kind: 'error', error: 'boom' })
    expect(classifyEvent({ text: 'x' }, true)).toEqual({ kind: 'text', text: 'x' })
    expect(classifyEvent({ toolCall: { id: 't', name: 'n', arguments: {} } }, true).kind).toBe('toolCall')
    expect(classifyEvent({ toolResult: { id: 't' } }, true).kind).toBe('toolResult')
  })
  it('only announces a session id when there is none yet, and otherwise falls through', () => {
    expect(classifyEvent({ sessionId: 's1' }, true)).toEqual({ kind: 'ignore' })
    expect(classifyEvent({ sessionId: 's1', text: 'x' }, true)).toEqual({ kind: 'text', text: 'x' })
  })
  it('gives usage priority, ignores empty text/error, and survives junk', () => {
    expect(classifyEvent({ usage: { used: 1, limit: 2 }, text: 'x', error: 'e' }, false).kind).toBe('usage')
    expect(classifyEvent({ text: '' }, true)).toEqual({ kind: 'ignore' })
    expect(classifyEvent({ error: '' }, true)).toEqual({ kind: 'ignore' })
    expect(classifyEvent({}, true)).toEqual({ kind: 'ignore' })
    expect(classifyEvent(null, true)).toEqual({ kind: 'ignore' })
    expect(classifyEvent(5 as any, true)).toEqual({ kind: 'ignore' })
  })
})

describe('applyEvent', () => {
  it('appends streamed text only to the reply being written', () => {
    const out = applyEvent([user, reply({ content: 'Hel' })], 'a1', { kind: 'text', text: 'lo' })
    expect(out.map((m) => m.content)).toEqual(['hi', 'Hello'])
    expect(out[0]).toBe(user) // untouched messages are the same objects
  })
  it('marks the reply final when the stream ends', () => {
    expect(applyEvent([reply()], 'a1', { kind: 'done' })[0].isFinal).toBe(true)
  })
  it('replaces the reply with an error line and closes it', () => {
    expect(applyEvent([reply({ content: 'partial' })], 'a1', { kind: 'error', error: 'It broke' })[0]).toMatchObject({ content: 'It broke', isFinal: true })
    expect(failAssistant([reply()], 'a1', 'Network error')[0]).toMatchObject({ content: 'Network error', isFinal: true })
  })
  it('adds a pending tool call, then fills in its result and clears pending', () => {
    let msgs = applyEvent([reply()], 'a1', { kind: 'toolCall', toolCall: { id: 't1', name: 'list_agents', arguments: { x: 1 } } })
    expect(msgs[0].toolCalls).toEqual([{ id: 't1', name: 'list_agents', arguments: { x: 1 }, pending: true }])
    msgs = applyEvent(msgs, 'a1', { kind: 'toolCall', toolCall: { id: 't2', name: 'open_page', arguments: {} } })
    msgs = applyEvent(msgs, 'a1', { kind: 'toolResult', toolResult: { id: 't1', result: { agents: [] }, success: true } })
    expect(msgs[0].toolCalls).toEqual([
      { id: 't1', name: 'list_agents', arguments: { x: 1 }, pending: false, result: { agents: [] }, success: true },
      { id: 't2', name: 'open_page', arguments: {}, pending: true },
    ])
  })
  it('handles a reply with no toolCalls array yet, and leaves other events alone', () => {
    const bare = { id: 'a1', role: 'assistant' as const, content: '', isFinal: false }
    expect(applyEvent([bare], 'a1', { kind: 'toolCall', toolCall: { id: 't', name: 'n', arguments: {} } })[0].toolCalls).toHaveLength(1)
    expect(applyEvent([bare], 'a1', { kind: 'toolResult', toolResult: { id: 'x' } })[0].toolCalls).toEqual([])
    const msgs = [reply()]
    expect(applyEvent(msgs, 'a1', { kind: 'ignore' })).toBe(msgs)
    expect(applyEvent(msgs, 'a1', { kind: 'usage', usage: { used: 1, limit: 2 } })).toBe(msgs)
    expect(applyEvent(msgs, 'a1', { kind: 'session', sessionId: 's' })).toBe(msgs)
  })
  it('ignores an event for a reply that is not in the list', () => {
    const out = applyEvent([reply()], 'other', { kind: 'text', text: 'x' })
    expect(out[0].content).toBe('')
  })
})

describe('navigationTarget', () => {
  it('only opens successful results that point inside this project', () => {
    expect(navigationTarget({ success: true, result: { href: '/p1/agents' } }, 'p1')).toBe('/p1/agents')
    expect(navigationTarget({ success: false, result: { href: '/p1/agents' } }, 'p1')).toBeNull()
    expect(navigationTarget({ success: true, result: { href: '/p2/agents' } }, 'p1')).toBeNull()
    expect(navigationTarget({ success: true, result: { href: 'https://evil.example/p1/x' } }, 'p1')).toBeNull()
    expect(navigationTarget({ success: true, result: { href: '//evil.example' } }, 'p1')).toBeNull()
    expect(navigationTarget({ success: true, result: { href: 5 } }, 'p1')).toBeNull()
    expect(navigationTarget({ success: true }, 'p1')).toBeNull()
  })
})

describe('withToolCallResult', () => {
  it('records the outcome on just the matching tool call', () => {
    const msgs: Message[] = [user, reply({ toolCalls: [{ id: 't1', name: 'a', arguments: {}, result: { __pending: true } }, { id: 't2', name: 'b', arguments: {} }] })]
    const out = withToolCallResult(msgs, 't1', { done: true }, true)
    expect(out[1].toolCalls![0]).toMatchObject({ id: 't1', result: { done: true }, success: true })
    expect(out[1].toolCalls![1]).toBe(msgs[1].toolCalls![1])
    expect(out[0].toolCalls).toBeUndefined()
  })
})

describe('consumeSse', () => {
  const streamOf = (...chunks: string[]) => new ReadableStream<Uint8Array>({
    start(c) { const enc = new TextEncoder(); chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close() },
  })
  it('delivers whole lines even when chunks split them, and drops a trailing partial line', async () => {
    const lines: string[] = []
    await consumeSse(streamOf('data: {"te', 'xt":"a"}\ndata: [DO', 'NE]\n', 'data: {"text":"cut off'), (l) => lines.push(l))
    expect(lines).toEqual(['data: {"text":"a"}', 'data: [DONE]'])
  })
  it('handles multi-byte characters split across chunks', async () => {
    const bytes = new TextEncoder().encode('data: {"text":"नमस्ते"}\n')
    const half = Math.floor(bytes.length / 2)
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes.slice(0, half)); c.enqueue(bytes.slice(half)); c.close() } })
    const onLine = vi.fn()
    await consumeSse(body, onLine)
    expect(onLine).toHaveBeenCalledWith('data: {"text":"नमस्ते"}')
  })
  it('finishes cleanly on an empty body', async () => {
    const onLine = vi.fn()
    await consumeSse(streamOf(), onLine)
    expect(onLine).not.toHaveBeenCalled()
  })
})
