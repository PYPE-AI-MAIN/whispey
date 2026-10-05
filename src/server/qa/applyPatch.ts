/**
 * Applying a suggested prompt change to the live prompt.
 *
 * Its own module rather than living in the route, because a Next.js route file
 * may only export handlers — and because this is the one piece of QA that edits
 * a production agent, so it has to be testable on its own.
 *
 * Matching is whitespace-insensitive but otherwise exact. A fuzzy match would be
 * worse than failing: silently editing the wrong line of a live agent's prompt
 * is the single outcome this feature cannot afford. If the prompt has moved on
 * since the suggestion was written, we say so and let a human look.
 */

const normalise = (s: string) => s.trim().replaceAll(/\s+/g, ' ')

const REPLACE = '\u0000REPLACE\u0000'
const DROP = '\u0000DROP\u0000'

export type PatchResult = { prompt: string; conflicts: string[] }

export function applyPatch(prompt: string, remove: string[], add: string[]): PatchResult {
  const conflicts: string[] = []

  // Nothing to remove: this is an addition, so append it.
  if (remove.length === 0) {
    const addition = add.join('\n')
    return {
      prompt: addition ? `${prompt.trimEnd()}\n\n${addition}\n` : prompt,
      conflicts,
    }
  }

  const lines = prompt.split('\n')
  let anchored = false

  for (const target of remove) {
    const wanted = normalise(target)
    const idx = lines.findIndex((l) => normalise(l) === wanted && l !== REPLACE && l !== DROP)

    if (idx === -1) {
      conflicts.push(target)
      continue
    }

    // the first line we remove is where the new lines land; the rest just go
    if (anchored) {
      lines[idx] = DROP
    } else {
      lines[idx] = REPLACE
      anchored = true
    }
  }

  // Any line we could not find means the prompt has drifted. Change nothing.
  if (conflicts.length) return { prompt, conflicts }

  const out: string[] = []
  for (const line of lines) {
    if (line === DROP) continue
    if (line === REPLACE) {
      out.push(...add)
      continue
    }
    out.push(line)
  }

  return { prompt: out.join('\n'), conflicts }
}

/** The agent's live prompt, wherever this platform keeps it. */
export function readPrompt(config: unknown): { prompt: string; path: 'assistant' | 'agent' } | null {
  const c = config as { agent?: { prompt?: unknown; assistant?: Array<{ prompt?: unknown }> } } | null
  const assistantPrompt = c?.agent?.assistant?.[0]?.prompt
  if (assistantPrompt !== undefined) {
    return { prompt: typeof assistantPrompt === 'string' ? assistantPrompt : '', path: 'assistant' }
  }
  const agentPrompt = c?.agent?.prompt
  if (agentPrompt !== undefined) {
    return { prompt: typeof agentPrompt === 'string' ? agentPrompt : '', path: 'agent' }
  }
  return null
}

export function writePrompt(config: unknown, path: 'assistant' | 'agent', prompt: string) {
  const next = structuredClone(config) as Record<string, any>
  if (path === 'assistant') next.agent.assistant[0].prompt = prompt
  else next.agent.prompt = prompt
  return next
}
