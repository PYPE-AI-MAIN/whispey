// Palette of the redesigned Call Logs, as CSS variables scoped to the v2 root
// (and to its portaled popovers, which render outside that root). Values are the
// approved mockup's, light then dark, so the page reads as one solid surface
// instead of the app-wide gray scale.
export const V2_THEME = [
  "[--cl-bg:#fbf8fc] dark:[--cl-bg:#0e0b16]",
  "[--cl-panel:#ffffff] dark:[--cl-panel:#14101d]",
  "[--cl-panel2:#fbf8fc] dark:[--cl-panel2:#171220]",
  "[--cl-raised:#ffffff] dark:[--cl-raised:#1d1829]",
  "[--cl-hover:#f4eff8] dark:[--cl-hover:#221c2f]",
  "[--cl-border:#ebe5f0] dark:[--cl-border:#2a2337]",
  "[--cl-border2:#d8cfe3] dark:[--cl-border2:#352d44]",
  "[--cl-text:#1e0a52] dark:[--cl-text:#f3eff6]",
  "[--cl-text2:#5a5272] dark:[--cl-text2:#b0a8c0]",
  "[--cl-text3:#7b7392] dark:[--cl-text3:#7d7590]",
  "[--cl-accent:#4b0082] dark:[--cl-accent:#ff6b6b]",
  "[--cl-accent-soft:rgba(75,0,130,.07)] dark:[--cl-accent-soft:rgba(255,107,107,.14)]",
  "[--cl-accent-line:rgba(75,0,130,.35)] dark:[--cl-accent-line:rgba(255,107,107,.45)]",
  "[--cl-accent-text:#4b0082] dark:[--cl-accent-text:#ff9a9a]",
  "[--cl-red:#e11d48] dark:[--cl-red:#f43f5e]",
  "[--cl-red-soft:rgba(225,29,72,.07)] dark:[--cl-red-soft:rgba(244,63,94,.12)]",
  "[--cl-red-line:rgba(225,29,72,.32)] dark:[--cl-red-line:rgba(244,63,94,.4)]",
  "[--cl-red-text:#be123c] dark:[--cl-red-text:#fda4af]",
  "[--cl-st-fail:#b45468] dark:[--cl-st-fail:#c0727f]",
  "[--cl-violet:#7c3aed] dark:[--cl-violet:#a78bfa]",
  "[--cl-violet-soft:rgba(124,58,237,.08)] dark:[--cl-violet-soft:rgba(167,139,250,.12)]",
  "[--cl-violet-line:rgba(124,58,237,.32)] dark:[--cl-violet-line:rgba(167,139,250,.4)]",
  "[--cl-violet-text:#6d28d9] dark:[--cl-violet-text:#c4b5fd]",
  "[--cl-shadow:0_12px_40px_rgba(30,10,82,.16)] dark:[--cl-shadow:0_12px_40px_rgba(0,0,0,.5)]",
].join(" ")

/** Toolbar button, as in the mockup. */
export const V2_BTN =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--cl-border)] bg-[var(--cl-panel2)] px-[11px] text-[13.5px] text-[var(--cl-text2)] transition-colors hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)] disabled:pointer-events-none disabled:opacity-50"

/** Square icon-only toolbar button. */
export const V2_ICON_BTN = `${V2_BTN} w-8 justify-center px-0`
