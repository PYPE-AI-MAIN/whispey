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
}

/** Below this a chart is unreadable, so resizing stops rather than allowing it. */
export const MIN_SIZE: Record<ChartKind, { w: number; h: number }> = {
  kpi: { w: 2, h: 2 },
  bar: { w: 3, h: 3 },
  line: { w: 3, h: 3 },
  pie: { w: 3, h: 4 },
  table: { w: 3, h: 3 },
}

export type GridItem = { i: string; x: number; y: number; w: number; h: number; minW: number; minH: number }

const LEGACY_WIDTH: Record<string, number> = { quarter: 3, half: 6, full: 12 }

/**
 * Reads a saved layout, whatever shape it is in, and fills the gaps by packing
 * cards left to right in their saved order.
 */
export function toGridLayout(widgets: Widget[]): GridItem[] {
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0

  return widgets.map((widget) => {
    const saved = (widget.layout ?? {}) as Partial<GridItem> & { width?: string }
    const fallback = DEFAULT_SIZE[widget.kind] ?? DEFAULT_SIZE.bar
    const min = MIN_SIZE[widget.kind] ?? MIN_SIZE.bar

    const w = clamp(saved.w ?? LEGACY_WIDTH[saved.width ?? ''] ?? fallback.w, min.w, GRID_COLUMNS)
    const h = Math.max(saved.h ?? fallback.h, min.h)

    if (typeof saved.x === 'number' && typeof saved.y === 'number') {
      return { i: widget.id, x: clamp(saved.x, 0, GRID_COLUMNS - w), y: saved.y, w, h, minW: min.w, minH: min.h }
    }

    // no coordinates: pack it after the last one, wrapping at the edge
    if (cursorX + w > GRID_COLUMNS) {
      cursorX = 0
      cursorY += rowHeight
      rowHeight = 0
    }
    const item = { i: widget.id, x: cursorX, y: cursorY, w, h, minW: min.w, minH: min.h }
    cursorX += w
    rowHeight = Math.max(rowHeight, h)
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
