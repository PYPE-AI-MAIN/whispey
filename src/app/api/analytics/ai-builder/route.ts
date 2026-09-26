/**
 * "Generate with AI" for the chart builder — a chat, not a one-shot box, so a
 * vague first attempt can be refined ("make it a pie instead", "last 7 days
 * not 30") the same way `/api/workflow/chat` already lets someone iterate on
 * a workflow. Structurally this mirrors that route closely on purpose: it is
 * proven in production, and a second hand-rolled streaming implementation is
 * a second place for the same bugs to hide.
 *
 * `spec.ts`'s own header calls `Spec` "the only contract between the canvas,
 * the suggestion engine, the LLM and the SQL compiler" — this is that third
 * leg. The model only ever sees this agent's real field catalog and is told
 * never to invent a column; whatever it returns is still re-validated
 * client-side against `Spec` (`aiChartSpec.ts`) before Apply is ever
 * clickable, the same way `WorkflowChat` validates before calling
 * `setWorkflow`. It also never leaves the surface `suggest.ts`'s rule-based
 * engine already proves works: grain is always 'interaction', dedupe and
 * element_source are stripped regardless of what the model wrote.
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { resolveAnalyticsContext, isDenied } from '@/server/analytics/context'

export const runtime = 'nodejs'
export const maxDuration = 120

const FieldIn = z.object({
  col: z.string(),
  path: z.array(z.string()).default([]),
  label: z.string(),
  value_type: z.string().nullable().optional(),
  boolean_encoding: z.string().nullable().optional(),
  is_dimension: z.boolean().optional(),
  coverage_pct: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  // Dropping these here silently strips them from the prompt below (zod
  // strips unlisted keys) — the model then has no way to tell a field the
  // agent's own Field Extractor declared apart from a plain built-in call
  // column, and "what can the field extractor build?" gets answered from
  // guesswork instead of the real declaration.
  group: z.string().nullable().optional(),
  declared: z.boolean().optional(),
})

const Body = z.object({
  agentId: z.string().uuid(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).min(1).max(40),
  fields: z.array(FieldIn).max(2000),
  ranking: z
    .object({ field: z.object({ col: z.string(), path: z.array(z.string()).optional() }), order: z.array(z.string()) })
    .nullable()
    .optional(),
  /** The last chart the client validated, if any — so a follow-up turn has something to edit. */
  currentChart: z.object({ title: z.string(), kind: z.string(), spec: z.record(z.unknown()) }).nullable().optional(),
})

/** Keeps the prompt bounded on an agent with a very large catalog — the best-covered fields are also the ones worth building a chart from. */
const MAX_FIELDS_IN_PROMPT = 150

const enc = new TextEncoder()
function sse(data: string) {
  return enc.encode(`data: ${data}\n\n`)
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna'
const MAX_TOKENS = 4000

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('No LLM API key configured (set OPENAI_API_KEY)')
  return new OpenAI({ apiKey })
}

function systemPrompt(
  fields: z.infer<typeof FieldIn>[],
  ranking: z.infer<typeof Body>['ranking'],
  currentChart: z.infer<typeof Body>['currentChart']
): string {
  const catalog = fields
    .slice()
    .sort((a, b) => (b.coverage_pct ?? 0) - (a.coverage_pct ?? 0))
    .slice(0, MAX_FIELDS_IN_PROMPT)
    .map((f) => ({
      col: f.col,
      path: f.path.length ? f.path : undefined,
      label: f.label,
      type: f.value_type,
      boolean_encoding: f.boolean_encoding ?? undefined,
      is_category: f.is_dimension || undefined,
      coverage_pct: f.coverage_pct ?? undefined,
      means: f.description ?? undefined,
      group: f.group ?? undefined,
      from_field_extractor: f.declared || undefined,
    }))

  return `You build ONE chart for a voice-agent call analytics dashboard called Whispey, chatting with the person building it.

The user will either ASK YOU A QUESTION ("what does this show?", "why no data?") or ask you to BUILD OR CHANGE the chart. Tell these apart:

- **Question, no change requested** — reply in PLAIN TEXT ONLY. Do NOT emit a \`\`\`json block.
- **Build or change the chart** — reply with 1-2 short sentences, THEN a fenced \`\`\`json block with the COMPLETE chart (never a partial patch, even for a one-field tweak):

\`\`\`json
{ "title": "short chart title", "kind": "kpi" | "bar" | "line" | "pie" | "table", "spec": { ... } }
\`\`\`

If the request is ambiguous about whether it's a question or a build, default to building — silence with no chart is worse than an extra one they can refine.

## Building the spec
- **kind**: "kpi" is one big number (a count or a rate) — "how many", "what percentage", "rate of". "line" is a trend over time — "over time", "trend", "by day/week/month". "bar" and "pie" both show a breakdown by category — prefer "bar" unless a pie is named explicitly. "table" is a plain list of categories with counts.
- **spec.spec_version**: always the number 1.
- **spec.agg**: what is being measured. \`{ "fn": "count" }\` for a plain count of calls. \`{ "fn": "rate", "field": <ref>, "denominator": "field_present" }\` for a yes/no field's percentage — "field" MUST be a boolean field from the catalog below, and you must copy that field's own "boolean_encoding" onto \`field.boolean_encoding\` (use "true_false" only if the catalog entry has none). Other functions: "count_distinct", "sum", "avg", "min", "max", "p50", "p95" — all except "count"/"count_distinct" need a numeric "field".
- **What "unique"/"distinct" means here — a row IS one call.** The call-id field already identifies each row uniquely, so \`count_distinct\` on it produces the exact same number as a plain \`count\` — it never tells you anything a plain count doesn't. A phone-number field identifies the CALLER, not the call, and the same person can call in many times, so a phone number repeats across rows in a way a call id never does. So: "unique calls" / "how many calls" / "unique count of calls" with no field named → plain \`{ "fn": "count" }\`, not \`count_distinct\` on the call id. "unique callers" / "unique numbers" / "unique customers" / "distinct people" → \`count_distinct\` with \`field\` set to the phone-number field. If asked to literally count distinct call ids anyway, build it, but say in your sentence that it comes out the same as a plain count since each call already has one.
- **spec.dimension** (bar/pie/table only, omit for kpi/line unless a breakdown is also wanted): \`{ "field": <ref>, "limit": 8 }\` — "field" must be a category-shaped field (marked "is_category": true, or enum-like). Cap "limit" at 8 for "pie", 12 otherwise.
- **spec.bucket** (line only): "day" is the sensible default; "hour"/"week"/"month" only if asked. Every other kind omits it or sets "none".
- **spec.filters** / **spec.having**: only when a condition is named ("only completed calls", "excluding wrong numbers"). Each entry: \`{ "field": <ref>, "op": "eq"|"neq"|"in"|"not_in"|"gt"|"gte"|"lt"|"lte"|"contains"|"starts_with"|"is_empty"|"is_not_empty"|"is_true"|"is_false", "value"?: string|number|boolean|array }\`. Default to "having" when unsure which one is meant.
- **spec.range**: \`{ "days": 30 }\` unless a different window is named (e.g. "last 7 days" → \`{ "days": 7 }\`).
- **spec.display**: \`{ "round": 1, "unit": "%" }\` for a rate/percentage, \`{ "round": 0 }\` otherwise.
- A **<ref>** is \`{ "col": "...", "path"?: [...] }\`, copied EXACTLY — col, path, boolean_encoding — from one catalog entry below. Never invent a column or path that isn't listed.
- Never include "grain", "dedupe", or "element_source" — not available here.
- If told the previous chart "failed validation" with a specific reason, fix exactly that and return the corrected complete chart.
- **A short follow-up that just names a field ("phone number", "by outcome", "agent name") means SWITCH the chart's current measured/grouped field to that one** — replace \`agg.field\` (or \`dimension.field\` for a breakdown) with the new field, keep everything else the same. Do NOT keep the old field and bolt on a filter for the new one instead — that changes what the number means, not just which field it's about. Only add a filter/having condition when the wording is actually about narrowing rows ("only where", "excluding", "filter to"). Example: draft is "Unique count of call id"; user says "phone number" → the new draft is "Unique count of phone number" (\`agg.field\` becomes the phone number field), never "Unique count of call id · only where phone number has any value".

## What each field's "group" means
- **"call"** — a real, always-present call column (duration, ended reason, environment, …).
- **"extracted"**, or **"from_field_extractor": true** — this field is exactly what this agent's own Field Extractor is configured to pull from the transcript. This is what "the field extractor" refers to when the user asks about it by name.
- **"metrics"** — computed quality/performance signals (latency, token/character usage, task-completion flags, …).
- **"metadata"** — other stored call metadata not covered above.
When asked specifically what the Field Extractor (or "extracted fields") can build, use ONLY fields with group "extracted" or "from_field_extractor": true — if there are none in the list below, say so plainly rather than describing other groups as if they were part of it.

## This agent's fields (best-covered first; "means" is what it actually captures, when known)
${JSON.stringify(catalog)}
${ranking?.order?.length ? `\n## This agent's outcome order, best first (context only, rarely needed directly)\n${JSON.stringify(ranking.order)}` : ''}
${currentChart ? `\n## The current draft chart (change this in place unless asked to start over)\n\`\`\`json\n${JSON.stringify(currentChart, null, 2)}\n\`\`\`` : ''}`
}

export async function POST(req: NextRequest) {
  const parsedBody = Body.safeParse(await req.json().catch(() => null))
  if (!parsedBody.success) {
    return Response.json({ error: parsedBody.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { agentId, messages, fields, ranking, currentChart } = parsedBody.data

  const resolved = await resolveAnalyticsContext(agentId)
  if (isDenied(resolved)) return resolved.errorResponse

  let client: OpenAI
  try {
    client = getClient()
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'AI is not configured' }, { status: 500 })
  }

  const convo: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt(fields, ranking ?? null, currentChart ?? null) },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  // A chart JSON is small; this is a safety net against a cut-off reply, not
  // an expected path — see /api/workflow/chat for the pattern this mirrors.
  const MAX_ROUNDS = 3

  ;(async () => {
    try {
      let finishReason: string | null | undefined
      let round = 0
      do {
        const stream = await client.chat.completions.create({
          model: MODEL,
          messages: convo,
          stream: true,
          max_completion_tokens: MAX_TOKENS,
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
          { role: 'user', content: 'Continue exactly where you stopped. Do not repeat anything already written and do not restart the JSON — just emit the remaining characters.' }
        )
      } while (++round < MAX_ROUNDS)

      if (finishReason === 'length') {
        await writer.write(sse(JSON.stringify({ truncated: true })))
      }
      await writer.write(sse('[DONE]'))
    } catch (err) {
      const message = err instanceof OpenAI.APIError ? err.message : err instanceof Error ? err.message : 'Unknown error'
      await writer.write(sse(JSON.stringify({ error: message })))
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
