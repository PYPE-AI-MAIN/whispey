import { describe, expect, test, vi } from 'vitest'
import OpenAI from 'openai'
import { streamChatCompletionRounds, openAiErrorMessage } from '@/lib/streamOpenAiChat'

function fakeStream(chunks: { content?: string; finish_reason?: string }[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) {
        yield { choices: [{ delta: { content: c.content }, finish_reason: c.finish_reason }] }
      }
    },
  }
}

function fakeWriter() {
  const frames: string[] = []
  return {
    frames,
    write: vi.fn(async (chunk: Uint8Array) => {
      frames.push(new TextDecoder().decode(chunk))
    }),
    close: vi.fn(async () => {}),
  } as unknown as WritableStreamDefaultWriter<Uint8Array>
}

describe('streamChatCompletionRounds', () => {
  test('streams content and ends with [DONE]', async () => {
    const create = vi.fn().mockResolvedValueOnce(fakeStream([{ content: 'hi' }, { content: ' there', finish_reason: 'stop' }]))
    const client = { chat: { completions: { create } } } as unknown as OpenAI
    const writer = fakeWriter()

    await streamChatCompletionRounds({
      client,
      convo: [],
      writer,
      model: 'test-model',
      maxTokens: 100,
      maxRounds: 3,
      continuePrompt: 'continue',
    })

    expect(create).toHaveBeenCalledTimes(1)
    expect(writer.frames.join('')).toContain('"content":"hi"')
    expect(writer.frames.join('')).toContain('"content":" there"')
    expect(writer.frames.at(-1)).toBe('data: [DONE]\n\n')
    expect(writer.close).toHaveBeenCalled()
  })

  test('continues into another round on a length cutoff, then reports truncated if still cut off', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(fakeStream([{ content: 'part1', finish_reason: 'length' }]))
      .mockResolvedValueOnce(fakeStream([{ content: 'part2', finish_reason: 'length' }]))
    const client = { chat: { completions: { create } } } as unknown as OpenAI
    const convo: OpenAI.Chat.ChatCompletionMessageParam[] = []
    const writer = fakeWriter()

    await streamChatCompletionRounds({
      client,
      convo,
      writer,
      model: 'test-model',
      maxTokens: 100,
      maxRounds: 2,
      continuePrompt: 'continue please',
    })

    expect(create).toHaveBeenCalledTimes(2)
    expect(convo.some((m) => m.role === 'user' && m.content === 'continue please')).toBe(true)
    expect(writer.frames.some((f) => f.includes('"truncated":true'))).toBe(true)
  })

  test('writes an error frame and still closes the writer when the client throws', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('boom'))
    const client = { chat: { completions: { create } } } as unknown as OpenAI
    const writer = fakeWriter()

    await streamChatCompletionRounds({
      client,
      convo: [],
      writer,
      model: 'test-model',
      maxTokens: 100,
      maxRounds: 3,
      continuePrompt: 'continue',
    })

    expect(writer.frames.some((f) => f.includes('"error":"boom"'))).toBe(true)
    expect(writer.close).toHaveBeenCalled()
  })
})

describe('openAiErrorMessage', () => {
  test('uses a plain Error message', () => {
    expect(openAiErrorMessage(new Error('bad'))).toBe('bad')
  })

  test('falls back to Unknown error for a non-Error throw', () => {
    expect(openAiErrorMessage('nope')).toBe('Unknown error')
  })
})
