/**
 * Validating pype_voice_agents.qa_config before it is saved.
 *
 * These numbers decide what the nightly job flags, so a typo here shows up as
 * a hundred wrong findings a week later rather than as an error now. Everything
 * is bounded, and the shape mirrors DEFAULTS in the lambda's
 * services/qa/rules.mjs — keep the two in step if a knob is added.
 */

export const QA_LIMITS = {
  sample_size: { min: 10, max: 2000, label: 'Calls checked per night' },
  normal_call_seconds: { min: 10, max: 3600, label: 'Normal call length' },
  min_call_seconds: { min: 1, max: 300, label: 'Too-short threshold' },
  success_in_seconds: { min: 1, max: 600, label: 'Minimum time for a success' },
  unanswered_over_seconds: { min: 1, max: 600, label: 'Unanswered-but-ran threshold' },
  max_utterance_words: { min: 10, max: 500, label: 'Longest agent turn' },
  latency_ms: { min: 200, max: 30_000, label: 'Latency limit' },
  silence_ms: { min: 500, max: 60_000, label: 'Silence limit' },
  slow_user_seconds: { min: 1, max: 120, label: 'Slow customer threshold' },
} as const

const NUMERIC_KEYS = Object.keys(QA_LIMITS) as Array<keyof typeof QA_LIMITS>
const LIST_KEYS = ['success_dispositions', 'unanswered_dispositions', 'disposition_values', 'foul_words'] as const

const MAX_LIST = 60
const MAX_VALUE_LEN = 120

export type QaConfig = {
  enabled: boolean
  flagged_share?: number
  flow_doc?: string
  timezone?: string
  send_window?: { start?: string; end?: string; timezone?: string }
} & Partial<Record<(typeof NUMERIC_KEYS)[number], number>>
  & Partial<Record<(typeof LIST_KEYS)[number], string[]>>

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/

/** @returns an error message, or null when the config is safe to store. */
export function qaConfigError(value: unknown): string | null {
  if (value === null) return null // clearing it is allowed — turns QA off entirely
  if (typeof value !== 'object' || Array.isArray(value)) return 'qa_config must be an object'

  const cfg = value as Record<string, unknown>

  if (typeof cfg.enabled !== 'boolean') return 'qa_config.enabled must be true or false'

  for (const key of NUMERIC_KEYS) {
    if (cfg[key] === undefined || cfg[key] === null) continue
    const n = Number(cfg[key])
    const { min, max, label } = QA_LIMITS[key]
    if (!Number.isFinite(n)) return `${label} must be a number`
    if (n < min || n > max) return `${label} must be between ${min} and ${max}`
  }

  if (cfg.flagged_share !== undefined && cfg.flagged_share !== null) {
    const n = Number(cfg.flagged_share)
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      return 'The flagged share must be between 0 and 1'
    }
  }

  for (const key of LIST_KEYS) {
    const list = cfg[key]
    if (list === undefined || list === null) continue
    if (!Array.isArray(list)) return `${key} must be a list`
    if (list.length > MAX_LIST) return `${key} can hold at most ${MAX_LIST} values`
    if (list.some((v) => typeof v !== 'string' || v.length > MAX_VALUE_LEN)) {
      return `${key} must be short text values`
    }
  }

  // A success disposition that is not in the allowed list can never match, so
  // the rule that depends on it would silently never fire.
  const allowed = Array.isArray(cfg.disposition_values) ? cfg.disposition_values.map((v) => String(v).toLowerCase()) : null
  if (allowed?.length) {
    for (const key of ['success_dispositions', 'unanswered_dispositions'] as const) {
      const list = Array.isArray(cfg[key]) ? (cfg[key] as string[]) : []
      const stray = list.find((v) => !allowed.includes(String(v).toLowerCase()))
      if (stray) return `"${stray}" is not in the list of allowed dispositions, so it would never match`
    }
  }

  if (cfg.send_window !== undefined && cfg.send_window !== null) {
    if (typeof cfg.send_window !== 'object' || Array.isArray(cfg.send_window)) {
      return 'The send window must be an object'
    }
    const w = cfg.send_window as Record<string, unknown>
    for (const edge of ['start', 'end'] as const) {
      if (w[edge] === undefined || w[edge] === null) continue
      if (typeof w[edge] !== 'string' || !HHMM.test(w[edge] as string)) {
        return `The send window ${edge} must look like 10:00`
      }
    }
    if (w.timezone !== undefined && w.timezone !== null) {
      if (typeof w.timezone !== 'string') return 'The send window timezone must be text'
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: w.timezone as string })
      } catch {
        // An unknown zone makes isInSendWindow hold forever, so nothing would
        // ever be delivered — catch it here rather than as silence later.
        return `"${w.timezone}" is not a timezone we recognise`
      }
    }
  }

  if (cfg.flow_doc !== undefined && cfg.flow_doc !== null) {
    if (typeof cfg.flow_doc !== 'string') return 'The flow document must be text'
    if (cfg.flow_doc.length > 60_000) return 'The flow document is too long (60,000 characters max)'
  }

  return null
}

export const QA_DEFAULTS: QaConfig = {
  enabled: true,
  sample_size: 200,
  normal_call_seconds: 120,
  min_call_seconds: 15,
  success_in_seconds: 20,
  unanswered_over_seconds: 30,
  max_utterance_words: 60,
  latency_ms: 3000,
  silence_ms: 5000,
  slow_user_seconds: 10,
  success_dispositions: [],
  unanswered_dispositions: [],
  disposition_values: [],
}
