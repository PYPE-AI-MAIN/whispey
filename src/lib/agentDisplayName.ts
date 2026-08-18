/**
 * What a human should see for an agent.
 *
 * `name` is the immutable backend identity (the backend agent is
 * `${name}_${id.replace(/-/g, '_')}`), so renames are stored in
 * `display_name` and this is the only thing that decides which one is shown.
 * Falls back to `name` so callers that never select `display_name` keep
 * rendering the old label instead of blank.
 */
export function agentDisplayName(
  agent?: { display_name?: string | null; name?: string | null } | null
): string {
  return agent?.display_name?.trim() || agent?.name?.trim() || ''
}

export const AGENT_DISPLAY_NAME_MAX = 64

/**
 * Normalize user input for `display_name`.
 * Returns `null` to mean "clear the override, fall back to `name`".
 * Throws on input that is too long — the API turns that into a 400.
 */
export function normalizeAgentDisplayName(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('display_name must be a string or null')
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > AGENT_DISPLAY_NAME_MAX) {
    throw new Error(`display_name must be ${AGENT_DISPLAY_NAME_MAX} characters or fewer`)
  }
  return trimmed
}
