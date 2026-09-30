// Dispositions = what the Studio calls the Field Extractor's output keys.
// Storage is unchanged: pype_voice_agents.field_extractor_prompt holds a JSON
// string of [{ key, description }], and field_extractor (boolean) is the gate
// the analytics lambda checks before extracting — both must be set together,
// or nothing gets extracted.

export interface Disposition {
  key: string
  description: string
}

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/
export const MAX_DISPOSITIONS = 20
const MAX_DESCRIPTION = 500

export type DispositionsResult =
  | { ok: true; dispositions: Disposition[] }
  | { ok: false; error: string }

export function validateDispositions(input: unknown): DispositionsResult {
  if (!Array.isArray(input)) return { ok: false, error: 'dispositions must be an array' }
  if (input.length > MAX_DISPOSITIONS) {
    return { ok: false, error: `At most ${MAX_DISPOSITIONS} dispositions are allowed` }
  }
  const seen = new Set<string>()
  const out: Disposition[] = []
  for (const item of input) {
    const key = typeof item?.key === 'string' ? item.key.trim() : ''
    const description = typeof item?.description === 'string' ? item.description.trim() : ''
    if (!KEY_RE.test(key)) {
      return { ok: false, error: `Invalid disposition key "${key}" — use lowercase letters, digits and underscores, starting with a letter (max 40 chars)` }
    }
    if (!description || description.length > MAX_DESCRIPTION) {
      return { ok: false, error: `Disposition "${key}" needs a description of 1-${MAX_DESCRIPTION} characters` }
    }
    if (seen.has(key)) return { ok: false, error: `Duplicate disposition key "${key}"` }
    seen.add(key)
    out.push({ key, description })
  }
  return { ok: true, dispositions: out }
}

/**
 * Columns to write for a validated list. An empty list turns extraction off
 * (and clears the prompt) rather than leaving it enabled with nothing to
 * extract. Existing field_extractor_variables are deliberately left alone.
 */
export function dispositionsToAgentColumns(dispositions: Disposition[]) {
  return dispositions.length > 0
    ? { field_extractor: true, field_extractor_prompt: JSON.stringify(dispositions) }
    : { field_extractor: false, field_extractor_prompt: null }
}

// Starting points the MCP offers when a caller doesn't know what to track.
export const DISPOSITION_SUGGESTIONS: Array<Disposition & { category: string }> = [
  { category: 'Outcome', key: 'call_outcome', description: 'Overall result of the call: one of completed, follow_up_needed, not_reachable, declined.' },
  { category: 'Outcome', key: 'goal_achieved', description: 'Whether the call achieved its main goal: yes or no.' },
  { category: 'Outcome', key: 'follow_up_required', description: 'Whether a human needs to follow up after this call: yes or no.' },
  { category: 'Customer', key: 'customer_sentiment', description: 'Customer sentiment across the call: positive, neutral or negative.' },
  { category: 'Customer', key: 'customer_intent', description: 'What the customer was trying to do, in a few words.' },
  { category: 'Customer', key: 'callback_time', description: 'Preferred time to be called back, if the customer gave one; otherwise "none".' },
  { category: 'Quality', key: 'agent_resolved_query', description: 'Whether the agent fully resolved the customer\'s query without escalation: yes or no.' },
  { category: 'Quality', key: 'escalation_requested', description: 'Whether the customer asked for a human agent: yes or no.' },
  { category: 'Healthcare', key: 'patient_reported_pain_score', description: 'Pain score the patient reported on a 1-10 scale; "none" if not given.' },
  { category: 'Healthcare', key: 'appointment_status', description: 'Appointment outcome: booked, rescheduled, cancelled or none.' },
  { category: 'Sales', key: 'lead_interest_level', description: 'Interest in the offer: high, medium, low or none.' },
  { category: 'Sales', key: 'payment_commitment', description: 'Whether the customer committed to pay, and when; otherwise "none".' },
]
