// Pure helpers shared by the MCP agent routes (/api/mcp/agents and
// /api/mcp/agents/[id]). Kept free of I/O so the rules — who may call, how a
// name is derived, what an update is allowed to touch — can be unit-tested.

import { timingSafeEqual } from 'node:crypto'

export interface VoiceRef {
  provider?: string
  voice_id?: string
}

/** True only when the caller sent exactly the configured shared secret. */
export function hasStudioSecret(header: string | null, expected: string | undefined): boolean {
  if (!header || !expected) return false
  const given = Buffer.from(header)
  const wanted = Buffer.from(expected)
  // timingSafeEqual throws on different lengths, and a length mismatch is
  // itself an answer — so reject before comparing.
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

/**
 * Backend-safe agent name from a freeform display name. The backend writes it
 * into a Python import statement when validating config updates, so it must be
 * lowercase alphanumeric/underscore only — a hyphen or space there is a
 * SyntaxError, not just a display issue.
 */
export function slugifyAgentName(displayName: string): string {
  const slug = displayName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('_')
    .slice(0, 40)
  return slug || 'agent'
}

/** Public URL of the Studio page for an agent. */
export function studioUrl(projectId: string, agentId: string, appUrl = 'http://localhost:3000'): string {
  const trimmed = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl
  return `${trimmed}/${projectId}/agents/${agentId}/studio`
}

/** Why a supplied voice is unusable, or null when it has both parts. */
export function voiceRefError(voice: VoiceRef | undefined): string | null {
  if (!voice?.provider || !voice?.voice_id) return 'voice requires provider and voice_id'
  return null
}

export interface AssistantUpdates {
  prompt?: string
  greeting?: string
  /** A complete tts config, already built for the chosen voice. */
  tts?: unknown
  variables?: Record<string, string>
}

/**
 * Applies ONLY prompt / greeting / voice / variables to an assistant; every
 * other field is carried over exactly as it was.
 */
export function applyAssistantUpdates(current: Record<string, any>, updates: AssistantUpdates): Record<string, any> {
  const next = { ...current }
  if (updates.prompt !== undefined) next.prompt = updates.prompt
  if (updates.greeting !== undefined) {
    next.first_message_mode = {
      ...current.first_message_mode,
      mode: 'assistant_speaks_first',
      first_message: updates.greeting,
    }
  }
  // Full replace, not a merge: Sarvam and ElevenLabs use different field
  // shapes, so carrying any old field over risks a stale value surviving a
  // provider switch.
  if (updates.tts !== undefined) next.tts = updates.tts
  // Merge, not replace: updating one value shouldn't require resending every
  // other variable the agent already has.
  if (updates.variables !== undefined) next.variables = { ...current.variables, ...updates.variables }
  return next
}
