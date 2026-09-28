/**
 * Shared by the AI Chart Builder and the workflow chat's `WorkflowChat.tsx` —
 * both stream a chat reply that ends in one fenced ```json block, and both
 * need to pull that block back out and keep old blocks from bloating history.
 */

/** The most recent fenced ```json block in `text`, or null if there isn't a complete one (yet, if still streaming). */
export function extractJsonFence(text: string): unknown {
  const start = text.lastIndexOf('```json')
  if (start === -1) return null
  const end = text.indexOf('```', start + 7)
  if (end === -1) return null
  const raw = text.slice(start + 7, end).trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Replaces every fenced ```json block in `text` with `placeholder` — a past
 * turn's JSON is already summarized elsewhere (a status badge, the current
 * draft resent separately), so repeating it in history only inflates every
 * later request for no benefit.
 * ponytail: walk fences with indexOf, not a backtracking [\s\S]*? regex.
 */
export function stripJsonFencesForHistory(text: string, placeholder: string): string {
  let result = ''
  let pos = 0
  while (pos < text.length) {
    const start = text.indexOf('```json', pos)
    if (start === -1) {
      result += text.slice(pos)
      break
    }
    const end = text.indexOf('```', start + 7)
    if (end === -1) {
      result += text.slice(pos)
      break
    }
    result += text.slice(pos, start) + placeholder
    pos = end + 3
  }
  return result
}
