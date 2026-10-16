// DNC checker: one more field the field extractor answers after each call,
// `dnc_requested` ("yes"/"no"). When the agent has dnc_checker_enabled and the
// answer is yes, the analytics lambda (services/dnc/dncChecker.mjs) adds the
// caller's +91 number to this agent's DNC list. The field's description is the
// editable "what counts" text; it's stored with the other fields in
// field_extractor_prompt but shown on its own tab, not in the fields list.

export const DNC_FIELD_KEY = 'dnc_requested'

// Keep in sync with DEFAULT_DNC_FIELD_DESCRIPTION in the analytics lambda.
export const DEFAULT_DNC_FIELD_DESCRIPTION = `Did the caller clearly ask not to be called again? Answer "yes" or "no".

Answer yes when the caller says things like:
- "Don't call me again" / "Stop calling me" / "Never call this number"
- "Remove my number" / "Take me off your list"
- "I have told you many times not to call me"
- The same in Hindi or any other language, e.g. "mujhe dobara call mat karna", "baar baar call mat karo"

Answer no for:
- "I'm busy", "call me later", "call me tomorrow", "not now" (a callback, not a refusal)
- "Not interested" on its own, without asking to stop calls
- Wrong number, or the call dropping
- The agent saying these words; only the caller's words count`

export const DNC_FIELD_DESCRIPTION_MAX = 4000

interface ExtractorField {
  key: string
  description: string
}

/** The DNC field, if the saved fields have one, and every other field. */
export function splitDncField<T extends ExtractorField>(fields: T[]): { dncField: T | null; otherFields: T[] } {
  const dncField = fields.find((f) => f.key === DNC_FIELD_KEY) ?? null
  return { dncField, otherFields: fields.filter((f) => f.key !== DNC_FIELD_KEY) }
}

/** The fields to save: the user's fields, plus the DNC field while the checker is on. */
export function withDncField(otherFields: ExtractorField[], dnc: { enabled: boolean; description: string }): ExtractorField[] {
  if (!dnc.enabled) return otherFields
  const description = dnc.description.trim() || DEFAULT_DNC_FIELD_DESCRIPTION
  return [...otherFields, { key: DNC_FIELD_KEY, description }]
}

/** A user-facing error for a bad dnc_checker_enabled, or null when it's fine to save. */
export function dncCheckerEnabledError(value: unknown): string | null {
  return typeof value === 'boolean' ? null : 'dnc_checker_enabled must be true or false'
}

/** dnc_checker_enabled for a PATCH body, only when it changed. */
export function dncCheckerChange(saved: boolean | null | undefined, next: boolean): { dnc_checker_enabled?: boolean } {
  return !!saved === next ? {} : { dnc_checker_enabled: next }
}
