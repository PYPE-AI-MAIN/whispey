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

/** How many characters of the label become the `name` prefix. */
export const AGENT_NAME_PREFIX_MAX = 10

/**
 * Derive the immutable `name` from a human label: first 10 sanitized chars.
 * The backend agent is then `${name}_${id.replace(/-/g, '_')}` as always.
 *
 * Constraints come from what the PypeAPI VM accepts as an agent folder name and
 * from what extractAgentIdFromBackendName() can still parse back out — letters
 * and underscores only, must start with a letter, no trailing underscore.
 * Digits are stripped rather than rejected so any label can produce a name.
 */
export function deriveAgentName(displayName: string): string {
  const derived = (displayName || '')
    .trim()
    .replaceAll(/\s+/g, '_')
    .replaceAll(/[^a-zA-Z_]/g, '')
    .replaceAll(/_+/g, '_')
    .replace(/^_+/, '')
    .slice(0, AGENT_NAME_PREFIX_MAX)
    .replace(/_+$/, '')
  // ponytail: labels with no letters at all ("24x7", "★") fall back to a
  // constant — the agent UUID in the backend name is what makes it unique.
  return derived || 'agent'
}

/**
 * Resolve a stored technical agent identifier (a raw agent id, or the
 * `${name}_${id.replace(/-/g, '_')}` backend dispatch name — see
 * resolveCampaignAgentName in campaigns/create/page.tsx) back to that
 * agent's display name. Falls back to the raw stored string when no match
 * is found (e.g. the agent was deleted).
 */
export function resolveStoredAgentName(
  agents: Array<{ id: string; name?: string | null; display_name?: string | null }>,
  stored: string
): string {
  if (!stored) return stored
  const byId = agents.find((a) => a.id === stored)
  if (byId) return agentDisplayName(byId)
  const parts = stored.trim().split('_')
  if (parts.length >= 5) {
    const uuid = parts.slice(-5).join('-')
    const byUuid = agents.find((a) => a.id === uuid)
    if (byUuid) return agentDisplayName(byUuid)
  }
  return stored
}
