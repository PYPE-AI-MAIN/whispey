import { describe, it, expect } from 'vitest'
import { toGridLayout, applyGridLayout, GRID_COLUMNS, DEFAULT_SIZE, MIN_SIZE } from '@/components/analytics/gridLayout'
import type { Widget } from '@/types/analytics'

const widget = (id: string, kind: Widget['kind'], layout: unknown): Widget => ({
  id, dashboard_id: 'd', title: id, kind,
  spec: { spec_version: 1, agg: { fn: 'count' }, range: { days: 30 } },
  layout: layout as Widget['layout'], position: 0, live: false, is_seeded: false,
})

describe('a dashboard saved before the grid still opens', () => {
  it('turns the three old widths into rectangles', () => {
    const items = toGridLayout([
      widget('a', 'kpi', { width: 'quarter' }),
      widget('b', 'bar', { width: 'half' }),
      widget('c', 'bar', { width: 'full' }),
    ])
    expect(items.map((i) => i.w)).toEqual([3, 6, 12])
  })

  it('packs cards with no coordinates instead of stacking them all at the origin', () => {
    const items = toGridLayout([
      widget('a', 'kpi', { width: 'quarter' }),
      widget('b', 'kpi', { width: 'quarter' }),
      widget('c', 'kpi', { width: 'quarter' }),
      widget('d', 'kpi', { width: 'quarter' }),
      widget('e', 'kpi', { width: 'quarter' }),
    ])
    expect(items.slice(0, 4).map((i) => i.x)).toEqual([0, 3, 6, 9])
    // the fifth does not hang off the edge
    expect(items[4]).toMatchObject({ x: 0 })
    expect(items[4].y).toBeGreaterThan(items[0].y)
  })

  it('keeps coordinates that were saved', () => {
    expect(toGridLayout([widget('a', 'bar', { x: 4, y: 2, w: 5, h: 6 })])[0]).toMatchObject({ x: 4, y: 2, w: 5, h: 6 })
  })

  it('gives a card with no layout at all the size its type needs', () => {
    expect(toGridLayout([widget('a', 'pie', undefined)])[0]).toMatchObject(DEFAULT_SIZE.pie)
  })

  it('drops a new full-width card below the dashboard, not on top of it', () => {
    // three rows of cards that all kept their own saved, non-overlapping
    // positions — none of them ever calls the internal packer, so it has no
    // idea the dashboard isn't empty
    const existing = [
      widget('a', 'kpi', { x: 0, y: 0, w: 3, h: 2 }),
      widget('b', 'kpi', { x: 3, y: 0, w: 3, h: 2 }),
      widget('c', 'bar', { x: 0, y: 2, w: 6, h: 5 }),
    ]
    // a full-width text block dropped mid-canvas collides with something in
    // every occupied row, so it always falls through to the packer
    const dropped = widget('d', 'text', { x: 0, y: 3, w: 12, h: 2 })
    const items = toGridLayout([...existing, dropped])
    const d = items[items.length - 1]
    expect(d.y).toBeGreaterThanOrEqual(7) // below 'c', which ends at y = 2 + 5
  })
})

describe('a card cannot be resized into something unreadable', () => {
  it('refuses to go below the minimum for its type', () => {
    const item = toGridLayout([widget('a', 'pie', { x: 0, y: 0, w: 1, h: 1 })])[0]
    expect(item.w).toBeGreaterThanOrEqual(MIN_SIZE.pie.w)
    expect(item.h).toBeGreaterThanOrEqual(MIN_SIZE.pie.h)
  })

  it('cannot start off the right-hand edge', () => {
    expect(toGridLayout([widget('a', 'bar', { x: 11, y: 0, w: 6, h: 5 })])[0].x).toBe(GRID_COLUMNS - 6)
  })
})

describe('moving a card changes what comes first', () => {
  it('renumbers in reading order — down the page, then across', () => {
    const widgets = [widget('a', 'kpi', {}), widget('b', 'kpi', {}), widget('c', 'kpi', {})]
    const moved = applyGridLayout(widgets, [
      { i: 'a', x: 6, y: 4, w: 3, h: 2 },
      { i: 'b', x: 0, y: 0, w: 3, h: 2 },
      { i: 'c', x: 3, y: 0, w: 3, h: 2 },
    ])
    expect(moved.map((w) => w.id)).toEqual(['b', 'c', 'a'])
    expect(moved.map((w) => w.position)).toEqual([0, 1, 2])
  })

  it('writes the rectangle back onto the card', () => {
    const moved = applyGridLayout([widget('a', 'bar', {})], [{ i: 'a', x: 2, y: 3, w: 8, h: 6 }])
    expect(moved[0].layout).toEqual({ x: 2, y: 3, w: 8, h: 6 })
  })

  it('leaves a card the grid did not report alone', () => {
    const original = widget('a', 'bar', { x: 1, y: 1, w: 4, h: 4 })
    expect(applyGridLayout([original], [])[0].layout).toEqual({ x: 1, y: 1, w: 4, h: 4 })
  })
})
