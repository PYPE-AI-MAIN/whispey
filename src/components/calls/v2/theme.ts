// Palette of the redesigned Call Logs, as CSS variables scoped to the v2 root
// (and to its portaled popovers, which render outside that root). Values are the
// approved mockup's, light then dark, so the page reads as one solid surface
// instead of the app-wide gray scale.
export const V2_THEME = [
  "[--cl-bg:#f8fafc] dark:[--cl-bg:#0b1120]",
  "[--cl-panel:#ffffff] dark:[--cl-panel:#0f172a]",
  "[--cl-panel2:#f8fafc] dark:[--cl-panel2:#111a2e]",
  "[--cl-raised:#ffffff] dark:[--cl-raised:#162036]",
  "[--cl-hover:#f1f5f9] dark:[--cl-hover:#1a2540]",
  "[--cl-border:#e2e8f0] dark:[--cl-border:#1e293b]",
  "[--cl-border2:#cbd5e1] dark:[--cl-border2:#273449]",
  "[--cl-text:#0f172a] dark:[--cl-text:#e2e8f0]",
  "[--cl-text2:#475569] dark:[--cl-text2:#94a3b8]",
  "[--cl-text3:#64748b] dark:[--cl-text3:#64748b]",
  "[--cl-accent:#2563eb] dark:[--cl-accent:#3b82f6]",
  "[--cl-accent-soft:rgba(37,99,235,.08)] dark:[--cl-accent-soft:rgba(59,130,246,.14)]",
  "[--cl-accent-line:rgba(37,99,235,.35)] dark:[--cl-accent-line:rgba(59,130,246,.45)]",
  "[--cl-accent-text:#1d4ed8] dark:[--cl-accent-text:#93c5fd]",
  "[--cl-red:#e11d48] dark:[--cl-red:#f43f5e]",
  "[--cl-red-soft:rgba(225,29,72,.07)] dark:[--cl-red-soft:rgba(244,63,94,.12)]",
  "[--cl-red-line:rgba(225,29,72,.32)] dark:[--cl-red-line:rgba(244,63,94,.4)]",
  "[--cl-red-text:#be123c] dark:[--cl-red-text:#fda4af]",
  "[--cl-st-fail:#b45468] dark:[--cl-st-fail:#c0727f]",
  "[--cl-violet:#7c3aed] dark:[--cl-violet:#a78bfa]",
  "[--cl-violet-soft:rgba(124,58,237,.08)] dark:[--cl-violet-soft:rgba(167,139,250,.12)]",
  "[--cl-violet-line:rgba(124,58,237,.32)] dark:[--cl-violet-line:rgba(167,139,250,.4)]",
  "[--cl-violet-text:#6d28d9] dark:[--cl-violet-text:#c4b5fd]",
  "[--cl-shadow:0_12px_40px_rgba(15,23,42,.16)] dark:[--cl-shadow:0_12px_40px_rgba(0,0,0,.5)]",
].join(" ")

/** Toolbar button, as in the mockup. */
export const V2_BTN =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel2)] px-[11px] text-[13.5px] text-[var(--cl-text2)] transition-colors hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)] disabled:pointer-events-none disabled:opacity-50"

/** Square icon-only toolbar button. */
export const V2_ICON_BTN = `${V2_BTN} w-8 justify-center px-0`
