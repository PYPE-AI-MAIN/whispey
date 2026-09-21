/**
 * Where each card sits and how big it is — Confluence "Analytics Phase 1 and 2
 * — Build Spec" §10.1.
 *
 * That section weighed dnd-kit plus a width toggle against a grid library and
 * chose the toggle, with one condition attached: "free resizing is what forces
 * a grid library, and nobody has asked for it". Somebody has now, so this is
 * the other branch — react-grid-layout owns placement, resizing and reflow, and
 * a card is a rectangle on a twelve-column grid rather than one of three
 * widths.
 *
 * Dashboards saved under the old shape still open: a width becomes a rectangle,
 * and anything without coordinates is laid out in order.
 */
import type { ChartKind, Widget } from '@/types/analytics'

export const GRID_COLUMNS = 12
export const ROW_HEIGHT = 56
export const GRID_MARGIN: [number, number] = [12, 12]

/** A number is a number; a chart needs room to be read. */
export const DEFAULT_SIZE: Record<ChartKind, { w: number; h: number }> = {
  kpi: { w: 3, h: 2 },
  bar: { w: 6, h: 5 },
  line: { w: 6, h: 5 },
  pie: { w: 4, h: 5 },
  table: { w: 6, h: 5 },
  // a heading plus a line or two of body text — the common Metabase pattern
  // of a section title sitting above the row of charts it introduces
  text: { w: 12, h: 2 },
  // one number, same footprint as a kpi
  formula: { w: 3, h: 2 },
}

/** Below this a chart is unreadable, so resizing stops rather than allowing it. */
export const MIN_SIZE: Record<ChartKind, { w: number; h: number }> = {
  kpi: { w: 2, h: 2 },
  bar: { w: 3, h: 3 },
  line: { w: 3, h: 3 },
  pie: { w: 3, h: 4 },
  table: { w: 3, h: 3 },
  text: { w: 2, h: 1 },
  formula: { w: 2, h: 2 },
}

export type GridItem = { i: string; x: number; y: number; w: number; h: number; minW: number; minH: number }

const LEGACY_WIDTH: Record<string, number> = { quarter: 3, half: 6, full: 12 }

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/**
 * Reads a saved layout, whatever shape it is in, and fills the gaps by packing
 * cards left to right in their saved order.
 *
 * Two widgets with saved rectangles that overlap — a bad write, a stale copy,
 * anything — used to be handed straight to react-grid-layout as-is. The grid's
 * own compaction pass silently resolves the overlap on render, which does not
 * match what this function just returned, so `onLayoutChange` fires believing
 * the user moved a card and marks the dashboard dirty on a page nobody
 * touched. A collision here is unpacked the same as a missing position,
 * instead of relying on the grid to mask a bad read.
 */
export function toGridLayout(widgets: Widget[]): GridItem[] {
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0
  const placed: GridItem[] = []

  // the lowest point of every card placed so far, including ones that kept
  // their own saved (x, y) and so never advanced `cursorY` themselves — a
  // dropped card that collides with one of those falls through to pack()
  // below, and without this it packs starting from wherever `cursorY`
  // happened to be left, which is usually the untouched (0, 0) it started
  // at — the reported "the new card jumps to the top" bug.
  const bottom = () => placed.reduce((m, p) => Math.max(m, p.y + p.h), 0)

  const pack = (w: number, h: number) => {
    if (cursorX + w > GRID_COLUMNS) {
      cursorX = 0
      cursorY += rowHeight
      rowHeight = 0
    }
    // only re-sync at the start of a row: mid-row this would push every
    // later card in the same row down onto its own row, since placing the
    // first one already raises `bottom()` past the row's own y
    if (cursorX === 0) cursorY = Math.max(cursorY, bottom())
    const at = { x: cursorX, y: cursorY }
    cursorX += w
    rowHeight = Math.max(rowHeight, h)
    return at
  }

  return widgets.map((widget) => {
    const saved = (widget.layout ?? {}) as Partial<GridItem> & { width?: string }
    const fallback = DEFAULT_SIZE[widget.kind] ?? DEFAULT_SIZE.bar
    const min = MIN_SIZE[widget.kind] ?? MIN_SIZE.bar

    const w = clamp(saved.w ?? LEGACY_WIDTH[saved.width ?? ''] ?? fallback.w, min.w, GRID_COLUMNS)
    const h = Math.max(saved.h ?? fallback.h, min.h)

    // Number.isFinite, not typeof: Infinity is a number, survives a spread, and
    // becomes null in JSON — which the save route rejects as a bad request
    let at =
      Number.isFinite(saved.x) && Number.isFinite(saved.y)
        ? { x: clamp(saved.x as number, 0, GRID_COLUMNS - w), y: saved.y as number }
        : null

    if (at && placed.some((p) => overlaps({ ...at!, w, h }, p))) at = null
    at ??= pack(w, h)

    const item = { i: widget.id, x: at.x, y: at.y, w, h, minW: min.w, minH: min.h }
    placed.push(item)
    return item
  })
}

/** Writes the grid back onto the widgets, in the order the grid reads them. */
export function applyGridLayout(
  widgets: Widget[],
  layout: readonly { i: string; x: number; y: number; w: number; h: number }[]
): Widget[] {
  const byId = new Map(layout.map((l) => [l.i, l]))
  return widgets
    .map((widget) => {
      const l = byId.get(widget.id)
      return l ? { ...widget, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : widget
    })
    // reading order — top to bottom, then left to right — so position still
    // means something to anything that does not draw a grid
    .sort((a, b) => {
      const la = byId.get(a.id)
      const lb = byId.get(b.id)
      if (!la || !lb) return 0
      return la.y - lb.y || la.x - lb.x
    })
    .map((widget, index) => ({ ...widget, position: index }))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** The row below everything already placed — where a new card goes. */
export function nextRow(widgets: Widget[]): number {
  return toGridLayout(widgets).reduce((lowest, item) => Math.max(lowest, item.y + item.h), 0)
}
