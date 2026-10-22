// Pure helpers behind Pi's smoothly streamed markdown, kept out of the component so they can be tested.

const COMBINING = /[\p{M}‌‍]/u

export const isFenceLine = (line: string): boolean => line.trimStart().startsWith('```')

/**
 * Split markdown into blocks at blank lines (outside code fences, and never before a
 * list/indented continuation) so finished blocks can be memoised and only the last one
 * is re-parsed while streaming.
 */
export function splitBlocks(text: string): string[] {
  const blocks: string[] = []
  let cur: string[] = []
  let fenced = false
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (isFenceLine(line)) fenced = !fenced
    cur.push(line)
    const next = lines[i + 1]
    if (!fenced && line.trim() === '' && next !== undefined && next.trim() !== '' && !/^(\s|[-*+]\s|\d+[.)]\s|\||>)/.test(next)) {
      blocks.push(cur.join('\n'))
      cur = []
    }
  })
  if (cur.length) blocks.push(cur.join('\n'))
  return blocks
}

/** Close markdown the stream hasn't finished yet so it never flashes raw `**` or backticks. */
export function closeOpenMarkdown(text: string): string {
  let out = text
  if (text.split('\n').filter(isFenceLine).length % 2) return `${out}\n\`\`\``
  if ((out.match(/\*\*/g) ?? []).length % 2) out += '**'
  if ((out.replaceAll('```', '').match(/`/g) ?? []).length % 2) out += '`'
  return out
}

/**
 * How much of `text` to show next when `shown` characters are already visible: a steady trickle
 * when close behind, faster when far behind, and never splitting a surrogate pair or a combining
 * mark (Devanagari/Kannada conjuncts).
 */
export function nextRevealLength(text: string, shown: number): number {
  const backlog = text.length - shown
  let n = Math.min(text.length, shown + Math.max(1, Math.ceil(backlog * 0.08)))
  if (n < text.length && n > 0 && /[\ud800-\udbff]/.test(text[n - 1])) n++
  while (n < text.length && COMBINING.test(text[n])) n++
  return n
}
