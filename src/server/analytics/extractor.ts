/**
 * What the agent was *told* to extract — the definition every disposition
 * already depends on.
 *
 * `pype_voice_agents.field_extractor_prompt` is a JSON array of
 * `{ key, description }`, one per extracted field, and it is the authority on
 * what those fields mean. The catalog was ignoring it completely and inferring
 * everything from sampled values instead, which gave two sources of truth and
 * showed the guess:
 *
 *   - `is_unassured_transfer` is defined by its prompt as **Score 1 / Score 0**.
 *     The catalog worked out "boolean, one_zero" from the data and the UI then
 *     said "yes / no" with nothing on screen connecting that to the 1 and 0 in
 *     the call log.
 *   - `something` is defined as "exactly one label from the following options:
 *     confirmed, cancellation_transfer, reschedule_transfer, …" — six labels.
 *     The catalog only ever sees the five that occurred in the sample window,
 *     so the sixth cannot be ranked, filtered for, or drawn as an empty bar.
 *
 * Reading the declaration fixes both. Sampling still decides coverage and what
 * is actually happening; the declaration decides what the field *is*.
 */

export type DeclaredField = {
  key: string
  description: string
  /** A one-line version for the picker. The descriptions are whole prompts. */
  summary: string
  /** What the prompt says the field holds, when it says so plainly enough. */
  declared?:
    | { kind: 'boolean'; encoding: 'one_zero' | 'yes_no' | 'true_false' }
    | { kind: 'enum'; values: string[] }
}

/** Longer than this in a picker is a paragraph, not a hint. */
const SUMMARY_MAX = 150

/**
 * These prompts are written as instructions, so the useful sentence is rarely
 * the first one — it is whatever follows "TASK:" when the author wrote one.
 */
export function summarise(description: string): string {
  const flat = description.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  const task = /(?:^|\s)TASK:\s*(.+?)(?=\s+[A-Z][A-Z ]{3,}:|$)/.exec(flat)
  const text = (task?.[1] ?? flat).trim()
  const sentence = /^(.+?[.?!])(?:\s|$)/.exec(text)?.[1] ?? text
  return sentence.length > SUMMARY_MAX ? `${sentence.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : sentence
}

/**
 * A declared list of labels: "return exactly one label from the following
 * options: a, b, c" / "one of: a, b or c".
 *
 * Deliberately narrow. A wrong value list is worse than none — it draws empty
 * bars for categories that do not exist — so anything that does not look like a
 * plain comma list of short identifiers is left to the sampler.
 */
function declaredEnum(flat: string): string[] | undefined {
  const m = /(?:exactly one label from the following options|one of the following|one of|following options)\s*:?\s*([^.]{3,300}?)\s*(?:\.|$)/i.exec(flat)
  if (!m) return undefined
  const values = m[1]
    .split(/\s*(?:,|\bor\b)\s*/)
    .map((v) => v.trim().replace(/^["'`]|["'`]$/g, ''))
    .filter(Boolean)
  const plausible = values.length >= 2 && values.length <= 30 && values.every((v) => /^[a-z0-9][a-z0-9_ -]{0,40}$/i.test(v))
  return plausible ? [...new Set(values)] : undefined
}

function declaredType(description: string): DeclaredField['declared'] {
  const flat = description.replace(/\*\*/g, '').replace(/\s+/g, ' ')

  // "(Score 1)" / "(Score 0)" — the convention every is_* prompt here uses
  if (/score\s*\(?1\)?/i.test(flat) && /score\s*\(?0\)?/i.test(flat)) {
    return { kind: 'boolean', encoding: 'one_zero' }
  }
  const values = declaredEnum(flat)
  if (values) return { kind: 'enum', values }

  // 'if … then "yes" otherwise no' — is_Conversation_hindi is written this way
  if (/"yes"/i.test(flat) && /\bno\b/i.test(flat) && flat.length < 400) {
    return { kind: 'boolean', encoding: 'yes_no' }
  }
  // 'return true if the patient is new, false otherwise'. Both words must be
  // there: "always return true" is an instruction, not a pair of outcomes.
  if (/\btrue\b/i.test(flat) && /\bfalse\b/i.test(flat) && flat.length < 600) {
    return { kind: 'boolean', encoding: 'true_false' }
  }
  return undefined
}

/**
 * Reads the stored prompt. Anything that is not the expected array is treated
 * as "no declaration" rather than an error: an agent whose prompt is free text
 * simply goes back to being inferred, which is what happens today.
 */
export function parseExtractorKeys(prompt: unknown): DeclaredField[] {
  if (typeof prompt !== 'string' || !prompt.trim()) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(prompt)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: DeclaredField[] = []
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue
    const key = (entry as { key?: unknown }).key
    const description = (entry as { description?: unknown }).description
    if (typeof key !== 'string' || !key.trim()) continue
    const text = typeof description === 'string' ? description : ''
    out.push({
      key: key.trim(),
      description: text,
      summary: text ? summarise(text) : '',
      ...(text ? { declared: declaredType(text) } : {}),
    })
  }
  return out
}

/**
 * The declared name and the written name are not always the same string.
 *
 * Tinkal declares `DoctorName`, `Count`, `Interruption_occurred`; the pipeline
 * writes `doctorName`, `count`, `interruption_occurred`. Matching exactly found
 * none of its five declarations, so the agent looked to the catalog as though
 * it had declared nothing at all — silently, which is the worst way for this to
 * fail.
 *
 * So: case and separators are ignored. Two declarations that collide once
 * normalised are both dropped rather than guessed between — a description
 * attached to the wrong field is worse than no description.
 */
const normaliseKey = (key: string): string => key.toLowerCase().replace(/[\s_.-]+/g, '')

export type DeclarationIndex = { exact: Map<string, DeclaredField>; loose: Map<string, DeclaredField> }

export function declaredByKey(prompt: unknown): DeclarationIndex {
  const declarations = parseExtractorKeys(prompt)
  const exact = new Map(declarations.map((d) => [d.key, d]))

  const loose = new Map<string, DeclaredField>()
  const ambiguous = new Set<string>()
  for (const d of declarations) {
    const k = normaliseKey(d.key)
    if (loose.has(k)) ambiguous.add(k)
    loose.set(k, d)
  }
  for (const k of ambiguous) loose.delete(k)

  return { exact, loose }
}

/** Exact spelling wins; the relaxed match is the fallback, never the override. */
export function findDeclaration(index: DeclarationIndex, leaf: string): DeclaredField | undefined {
  return index.exact.get(leaf) ?? index.loose.get(normaliseKey(leaf))
}

/* -------------------------------------------------- applying it to the catalog */

/** Which part of a call a field came from — the grouping the picker shows. */
export type FieldGroup = 'call' | 'extracted' | 'metrics' | 'metadata'

/** One flat list of 103 fields is a list nobody reads. These are the headings. */
export const GROUP_LABEL: Record<FieldGroup, string> = {
  call: 'Call details',
  extracted: 'Extracted by the agent',
  metrics: 'Quality metrics',
  metadata: 'Call metadata',
}

/** The order they are shown in: what the platform records, then what the agent decided. */
export const GROUP_ORDER: FieldGroup[] = ['call', 'extracted', 'metrics', 'metadata']

export function groupOf(col: string, path: string[]): FieldGroup {
  if (path.length === 0) return 'call'
  // the extractor writes everything it produces into transcription_metrics,
  // declared or not — final_disposition is produced downstream and appears here
  // with no declaration behind it
  if (col === 'transcription_metrics') return 'extracted'
  if (col === 'metrics') return 'metrics'
  return 'metadata'
}

type CatalogRow = {
  col: string
  path?: string[] | null
  value_type?: unknown
  boolean_encoding?: unknown
  enum_values?: unknown
  type_confirmed?: unknown
  [key: string]: unknown
}

/**
 * Lets the declaration win over what sampling guessed — except where a person
 * has confirmed the type themselves, which beats both.
 *
 * Two things change, and both were wrong before:
 *
 *  - **The encoding.** `is_unassured_transfer` holds 1 and 0 because its prompt
 *    says Score 1 / Score 0. Sampling reached the same answer here, but by
 *    coincidence: a field whose sample happens to contain only `1` is read as a
 *    one-value enum, and a field written as yes/no in one release and 1/0 in the
 *    next is read as whichever the last 2,000 rows happen to hold.
 *  - **The value list.** Sampling can only report values that occurred. The
 *    declaration knows the ones that have not yet, so they can be ranked,
 *    filtered for, and drawn as the empty bars they are.
 *
 * `description` is the prompt's own words, and the prompt is only shown to
 * people allowed to see it.
 */
export function applyDeclarations<T extends CatalogRow>(
  rows: T[],
  prompt: unknown,
  opts: { includeDescription: boolean }
): (T & { group: FieldGroup; declared: boolean; description: string | null })[] {
  const declared = declaredByKey(prompt)

  return rows.map((row) => {
    const path = (row.path ?? []) as string[]
    const leaf = path[path.length - 1] ?? ''
    const d = path.length ? findDeclaration(declared, leaf) : undefined
    const group = groupOf(row.col, path)
    const base = {
      ...row,
      group,
      declared: Boolean(d),
      description: d && opts.includeDescription && d.summary ? d.summary : null,
    }

    // a person's confirmed type is the one source that beats the declaration
    if (!d?.declared || row.type_confirmed === true) return base

    if (d.declared.kind === 'boolean') {
      return { ...base, value_type: 'boolean', boolean_encoding: d.declared.encoding }
    }

    // declared order first — it is the order the author wrote them in, which is
    // more meaningful than alphabetical — then anything the agent is producing
    // that the declaration never mentioned
    const stated = d.declared.values
    const seen = Array.isArray(row.enum_values) ? (row.enum_values as string[]) : []
    return { ...base, value_type: 'enum', enum_values: [...stated, ...seen.filter((v) => !stated.includes(v))] }
  })
}
