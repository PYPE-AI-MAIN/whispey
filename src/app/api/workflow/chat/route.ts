import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { streamChatCompletionRounds } from '@/lib/streamOpenAiChat'
import {
  builderSystemContent,
  WORKFLOW_BUILDER_MODEL as MODEL,
  WORKFLOW_BUILDER_MAX_TOKENS as MAX_TOKENS,
  WORKFLOW_BUILDER_MAX_ROUNDS as MAX_ROUNDS,
  WORKFLOW_BUILDER_CONTINUE_PROMPT as CONTINUE_PROMPT,
} from '@/lib/workflow/builderPrompt'

export const runtime = 'nodejs'
// A large workflow can take a while just to reach the first output token,
// let alone finish across MAX_ROUNDS continuations — the platform default
// (as low as 10-60s) kills the function mid-generation with no error frame,
// which looks to the client like the response never arrives. Vercel clamps
// this to whatever the plan actually allows, so it's safe to ask for the max.
export const maxDuration = 300

// The system prompt already resends the FULL current workflow every turn (the
// model needs current state to edit it — a deliberate tradeoff, not trimmed
// here), so old chat turns are the one thing that's safe to cap: they mostly
// restate context already reflected in that workflow. Without a cap, a long
// AI Builder session keeps growing the request forever, pushing time-to-
// first-token past the client's stall timeout. Keep the last few exchanges
// for short-term coherence ("do that for this node too") and drop the rest.
const MAX_HISTORY_MESSAGES = 16

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('No LLM API key configured (set OPENAI_API_KEY)')
  return new OpenAI({ apiKey })
}

export async function POST(req: NextRequest) {
  const { messages, workflow } = await req.json()
  if (!messages?.length) {
    return Response.json({ error: 'No messages' }, { status: 400 })
  }

  let client: OpenAI
  try {
    client = getClient()
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }

  const systemContent = builderSystemContent(workflow)

  const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES)

  const convo: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    ...recentMessages.map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content })),
  ]

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  // A big new workflow can't fit in one completion. When the model stops with
  // finish_reason "length" mid-JSON, feed its partial output back and let it
  // continue exactly where it left off, stitching rounds into one stream. The
  // client just accumulates `content`, so continuation is transparent to it.
  // 128K output makes this a rare safety net rather than the common path it
  // was at gpt-4.1's 32K cap.
  streamChatCompletionRounds({ client, convo, writer, model: MODEL, maxTokens: MAX_TOKENS, maxRounds: MAX_ROUNDS, continuePrompt: CONTINUE_PROMPT })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
