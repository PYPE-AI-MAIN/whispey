import { useEffect } from 'react'
import { useWorkflowStore } from '@/stores/workflowStore'

/** True when the keys belong to a text field (typing, its own undo) and not to the canvas. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el?.tagName) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.closest?.('.monaco-editor')
}

/** Ctrl or Cmd + Z undoes, and Shift + Z (or Ctrl + Y) redoes, everything since the last deploy. */
export function useUndoShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      const { undo, redo } = useWorkflowStore.getState()
      if (key === 'z' && !e.shiftKey) undo()
      else if ((key === 'z' && e.shiftKey) || key === 'y') redo()
      else return
      e.preventDefault()
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [])
}
