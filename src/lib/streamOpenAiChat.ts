import OpenAI from 'openai'

/**
 * Shared by every SSE chat route that streams an OpenAI completion straight
 * to the client (ai-builder, workflow chat, …): encode-as-SSE, turn a
 * `finish_reason: "length"` cutoff into a same-request continuation round,
 * and normalize whatever the SDK throws into one error string.
 */

const enc = new TextEncoder()
export function sse(data: string) {
  return enc.encode(`data: ${data}\n\n`)
}

export function openAiErrorMessage(err: unknown): string {
  if (err instanceof OpenAI.APIError) return err.message
  if (err instanceof Error) return err.message
  return 'Unknown error'
}

/**
 * Runs `convo` through `client`, streaming each token as `{content}` SSE
 * frames. If the model stops mid-generation (`finish_reason: "length"`), the
 * partial output is fed back with `continuePrompt` so it can resume without
 * repeating itself, up to `maxRounds` rounds — a rare safety net, not the
 * common path, for a reply that's too long to fit in one completion.
 * Always ends the stream with `[DONE]` (or an `{error}` frame) and closes
 * `writer`.
 */
export async function streamChatCompletionRounds(opts: {
  client: OpenAI
  convo: OpenAI.Chat.ChatCompletionMessageParam[]
  writer: WritableStreamDefaultWriter<Uint8Array>
  model: string
  maxTokens: number
  maxRounds: number
  continuePrompt: string
}) {
  const { client, convo, writer, model, maxTokens, maxRounds, continuePrompt } = opts
  try {
    let finishReason: string | null | undefined
    let round = 0
    do {
      const stream = await client.chat.completions.create({
        model,
        messages: convo,
        stream: true,
        max_completion_tokens: maxTokens,
      })
      let roundContent = ''
      finishReason = undefined
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content
        if (content) {
          roundContent += content
          await writer.write(sse(JSON.stringify({ content })))
        }
        if (chunk.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason
      }
      if (finishReason !== 'length') break
      convo.push(
        { role: 'assistant', content: roundContent },
        { role: 'user', content: continuePrompt }
      )
    } while (++round < maxRounds)

    if (finishReason === 'length') {
      await writer.write(sse(JSON.stringify({ truncated: true })))
    }
    await writer.write(sse('[DONE]'))
  } catch (err) {
    await writer.write(sse(JSON.stringify({ error: openAiErrorMessage(err) })))
  } finally {
    await writer.close()
  }
}
