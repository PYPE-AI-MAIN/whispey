import { customAwayPrompt } from '@/config/agentDefaults'

/**
 * What to store when the owner presses Save in the dynamic message prompt editor. Text that is blank or identical to
 * the backend default stores nothing, so the agent keeps following the default (including later improvements).
 */
export function awayPromptToSave(draft: string, defaultPrompt?: string): string | undefined {
  const text = customAwayPrompt(draft)
  if (text === undefined) return undefined
  return defaultPrompt !== undefined && text === defaultPrompt.trim() ? undefined : text
}

/** Whether the editor holds unsaved changes relative to what it opened with. */
export function isAwayPromptDirty(draft: string | null, initial: string): boolean {
  return draft !== null && draft.trim() !== initial.trim()
}
