/**
 * The allowed values of an extracted field, read out of its prompt by a small model instead of guessed by patterns.
 *
 * The prompt for a field is free text written by a person ("one of these sixteen values: a | b | c", a bullet list,
 * a table...), so no fixed pattern covers every way of writing it. The model only *finds* the list: every value it
 * returns must appear word for word in the prompt, or it is thrown away, so it can never invent a label. Answers are
 * remembered per prompt text, so a prompt costs one call until someone edits it. If the model is not configured, is
 * slow or fails, the caller keeps the pattern-based reading in extractor.ts.
 */
import { createHash } from 'node:crypto'
import { AzureOpenAI, OpenAI } from 'openai'
import { parseExtractorKeys } from './extractor'

/** Shorter than this does not list labels. */
const MIN_DESCRIPTION = 40
/** The picker must not wait on the model longer than this; late answers still fill the cache for the next load. */
const WAIT_MS = 5000
const CALL_TIMEOUT_MS = 20_000
const CACHE_MAX = 500
const MAX_PROMPT_CHARS = 16_000

const SYSTEM = [
  'You read the instructions given to a model that fills in ONE field of a call record.',
  'If the instructions list the allowed values for the field (a closed set of labels it must be one of), return them exactly as written, in the order given.',
  'If they do not give a closed set of labels (free text, a name, a number, a yes/no or true/false question, or a 1/0 score), return an empty list.',
  'Never invent, rename, merge, translate or correct a value.',
  'Reply with JSON only: {"values": ["...", "..."]}',
].join('\n')

// text → values the model found, or null when it answered "none"; a failed call is not stored
const cache = new Map<string, string[] | null>()
const inflight = new Map<string, Promise<string[] | null | undefined>>()

const idOf = (key: string, description: string) => createHash('sha256').update(`${key}\n${description}`).digest('hex')

/** A pass/fail score is not a list of labels: those fields keep their 1/0 or yes/no reading (the KPI tiles depend on it). */
const SCORE_VALUES = new Set(['1', '0', '-', 'yes', 'no', 'true', 'false', 'n/a', 'na', 'null', 'none'])

/** Keeps only values the prompt itself contains, word for word. Null when fewer than two survive, or they are only a score. */
export function groundedValues(description: string, answer: unknown): string[] | null {
  if (!Array.isArray(answer)) return null
  const text = description.toLowerCase()
  const values = [...new Set(answer.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean))]
    .filter((v) => v.length <= 60 && !v.includes('\n') && text.includes(v.toLowerCase()))
  if (values.length < 2 || values.length > 40) return null
  return values.every((v) => SCORE_VALUES.has(v.toLowerCase())) ? null : values
}

function client(): OpenAI | null {
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
    return new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.OPENAI_API_VERSION || '2024-12-01-preview',
      timeout: CALL_TIMEOUT_MS,
    })
  }
  return process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: CALL_TIMEOUT_MS }) : null
}

/** undefined = the call failed (try again next time); null = the model answered and there are no values. */
async function ask(key: string, description: string): Promise<string[] | null | undefined> {
  const llm = client()
  if (!llm) return undefined
  try {
    const res = await llm.chat.completions.create({
      model: process.env.AZURE_DEPLOYMENT_NAME || 'gpt-4.1-mini',
      temperature: 0,
      max_completion_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Field: ${key}\n\nInstructions:\n${description.slice(0, MAX_PROMPT_CHARS)}` },
      ],
    })
    const answer = JSON.parse(res.choices[0]?.message?.content ?? '{}') as { values?: unknown }
    return groundedValues(description, answer.values)
  } catch (err) {
    console.error('[analytics/llmValues] could not read the values for', key, err)
    return undefined
  }
}

function lookup(key: string, description: string): Promise<string[] | null | undefined> {
  const id = idOf(key, description)
  if (cache.has(id)) return Promise.resolve(cache.get(id))
  let pending = inflight.get(id)
  if (!pending) {
    pending = ask(key, description).then((values) => {
      if (values !== undefined) {
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
        cache.set(id, values)
      }
      return values
    }).finally(() => inflight.delete(id))
    inflight.set(id, pending)
  }
  return pending
}

/** field key → the values its prompt allows, for every field where the model found a closed list. */
export async function llmDeclaredValues(prompt: unknown): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>()
  const fields = parseExtractorKeys(prompt).filter((d) => d.description.length >= MIN_DESCRIPTION && d.declared?.kind !== 'boolean')
  const all = Promise.all(fields.map(async (d) => {
    const values = await lookup(d.key, d.description)
    if (values) found.set(d.key, values)
  }))
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, WAIT_MS))])
  return new Map(found)
}
