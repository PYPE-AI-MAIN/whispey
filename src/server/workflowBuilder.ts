// Runs the AI Builder on the server, without the canvas: same instructions,
// model, continuation and self-correction pass as the canvas chat
// (WorkflowChat.tsx + /api/workflow/chat), so a flow requested through the MCP
// comes out the way it would have on the canvas.

import OpenAI from 'openai'
import {
  builderSystemContent,
  WORKFLOW_BUILDER_CONTINUE_PROMPT,
  WORKFLOW_BUILDER_MAX_ROUNDS,
  WORKFLOW_BUILDER_MAX_TOKENS,
  WORKFLOW_BUILDER_MODEL,
} from '@/lib/workflow/builderPrompt'
import { checkBuilderOutput } from '@/lib/workflow/builderOutput'
import { isRetryableApplyError } from '@/lib/workflow/chatRetry'
import type { Workflow } from '@/lib/workflow/schema'

type Message = OpenAI.Chat.ChatCompletionMessageParam

export type BuildResult =
  | { ok: true; workflow: Workflow; warnings: string[]; reply: string }
  | { ok: false; error: string }

/** One reply, stitched across continuation rounds when it runs out of length. */
async function completeReply(client: OpenAI, convo: Message[]): Promise<{ text: string; truncated: boolean }> {
  const messages = [...convo]
  let text = ''
  for (let round = 0; round < WORKFLOW_BUILDER_MAX_ROUNDS; round++) {
    const res = await client.chat.completions.create({
      model: WORKFLOW_BUILDER_MODEL,
      messages,
      max_completion_tokens: WORKFLOW_BUILDER_MAX_TOKENS,
    })
    const choice = res.choices[0]
    const part = choice?.message?.content ?? ''
    text += part
    if (choice?.finish_reason !== 'length') return { text, truncated: false }
    messages.push({ role: 'assistant', content: part }, { role: 'user', content: WORKFLOW_BUILDER_CONTINUE_PROMPT })
  }
  return { text, truncated: true }
}

/** The explanation the builder writes after its JSON block — safe to show (no prompts). */
function replyText(text: string): string {
  const end = text.lastIndexOf('```')
  return (end === -1 ? text : text.slice(end + 3)).trim()
}

export async function runWorkflowBuilder(opts: {
  instruction: string
  current?: Workflow | null
  client?: OpenAI
}): Promise<BuildResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!opts.client && !apiKey) return { ok: false, error: 'AI Builder is not configured (OPENAI_API_KEY missing)' }
  const client = opts.client ?? new OpenAI({ apiKey, timeout: 240_000 })

  const convo: Message[] = [
    { role: 'system', content: builderSystemContent(opts.current ?? null) },
    { role: 'user', content: opts.instruction },
  ]

  // Same policy as the canvas: one automatic self-correction pass with the
  // exact validation/lint errors, then report whatever is left.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, truncated } = await completeReply(client, convo)
    if (truncated) {
      return { ok: false, error: 'The AI Builder reply was too long to finish. Ask for a smaller flow, or build it in steps.' }
    }
    const result = checkBuilderOutput(text, opts.current ?? null)
    if (result.status === 'ok') {
      return { ok: true, workflow: result.workflow, warnings: result.warnings, reply: replyText(text) }
    }
    if (result.status === 'none') {
      // The builder answered in prose (it treats unclear requests as questions).
      return { ok: false, error: `The AI Builder did not produce a flow. It said: ${text.trim().slice(0, 600)}` }
    }
    if (attempt === 1 || !isRetryableApplyError(result.error)) return { ok: false, error: result.error }
    convo.push(
      { role: 'assistant', content: '(previous attempt — see error below)' },
      {
        role: 'user',
        content: `The workflow you just returned failed validation: ${result.error}. Fix these specific issues and return the corrected COMPLETE workflow JSON.`,
      }
    )
  }
  return { ok: false, error: 'The AI Builder could not produce a valid flow.' }
}
