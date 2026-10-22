// Prompt edits Ask Pi suggests in Prompt Forge, written as a fenced block:
//
//   ```prompt-edit
//   FIND:
//   <exact text from the prompt>
//   REPLACE:
//   <the new text>
//   ```
//
// The Pi panel shows each as a card with an Apply button.

export interface PromptEdit {
  find: string
  replace: string
}

/** Text with one leading line break removed (the one right after a label). */
const afterLabel = (s: string) => (s.startsWith('\n') ? s.slice(1) : s)

const FIND_LABEL = 'FIND:'
const REPLACE_LABEL = 'REPLACE:'

/** The edit in a prompt-edit block, or null when it isn't one. */
export function parsePromptEdit(block: string): PromptEdit | null {
  const text = block.replaceAll('\r\n', '\n').trimStart()
  if (!text.startsWith(FIND_LABEL)) return null
  const replaceAt = text.indexOf(`\n${REPLACE_LABEL}`)
  if (replaceAt === -1) return null
  const find = afterLabel(text.slice(FIND_LABEL.length, replaceAt)).trimEnd()
  const replace = afterLabel(text.slice(replaceAt + REPLACE_LABEL.length + 1)).trimEnd()
  return find.trim() ? { find, replace } : null
}

/** The prompt with the edit applied, or why it can't be. Only an exact, single match is replaced. */
export function applyPromptEdit(prompt: string, edit: PromptEdit): { ok: true; prompt: string } | { ok: false; reason: string } {
  const at = prompt.indexOf(edit.find)
  if (at === -1) return { ok: false, reason: 'That text is no longer in the prompt' }
  if (prompt.includes(edit.find, at + 1)) return { ok: false, reason: 'That text appears more than once in the prompt' }
  return { ok: true, prompt: prompt.slice(0, at) + edit.replace + prompt.slice(at + edit.find.length) }
}
