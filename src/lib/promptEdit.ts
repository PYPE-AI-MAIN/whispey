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

/** The edit in a prompt-edit block, or null when it isn't one. */
export function parsePromptEdit(block: string): PromptEdit | null {
  const m = /^\s*FIND:\s*\n([\s\S]*?)\n\s*REPLACE:\s*\n?([\s\S]*)$/.exec(block.replace(/\r\n/g, '\n'))
  if (!m) return null
  const find = m[1].replace(/\n+$/, '')
  const replace = m[2].replace(/\n+$/, '')
  return find.trim() ? { find, replace } : null
}

/** The prompt with the edit applied, or why it can't be. Only an exact, single match is replaced. */
export function applyPromptEdit(prompt: string, edit: PromptEdit): { ok: true; prompt: string } | { ok: false; reason: string } {
  const at = prompt.indexOf(edit.find)
  if (at === -1) return { ok: false, reason: 'That text is no longer in the prompt' }
  if (prompt.indexOf(edit.find, at + 1) !== -1) return { ok: false, reason: 'That text appears more than once in the prompt' }
  return { ok: true, prompt: prompt.slice(0, at) + edit.replace + prompt.slice(at + edit.find.length) }
}
