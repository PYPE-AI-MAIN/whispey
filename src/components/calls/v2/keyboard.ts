/** True when a key press belongs to something else: a text field, or an open dialog/menu/popover. */
export function keyboardIsBusy(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return true
  return !!document.querySelector('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')
}

/** ⌘> / ⌘< (also ⌘. / ⌘, — the same keys without Shift, as some layouts report them). */
export function pageKey(e: KeyboardEvent): "next" | "prev" | null {
  if (!(e.metaKey || e.ctrlKey)) return null
  if (e.key === ">" || e.key === "." || e.code === "Period") return "next"
  if (e.key === "<" || e.key === "," || e.code === "Comma") return "prev"
  return null
}
