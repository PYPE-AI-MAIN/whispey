/**
 * A bar click resolving to the wrong thing looks exactly like the drill-through
 * silently matching nothing — "N calls became 0 rows" — while the tooltip right
 * next to it shows the correct name, since it reads a separate code path.
 */
import { describe, it, expect } from 'vitest'
import { readX } from '@/components/analytics/ChartRenderer'

describe('reading the clicked category off a recharts click event', () => {
  it('reads the category from a Bar click, where it is nested under .payload', () => {
    // a <Bar onClick> argument is the rectangle's own render props — x/y/width/height
    // are the bar's pixel geometry, not the data. The real point is under .payload.
    const barClickEvent = { x: 214, y: 40, width: 32, height: 120, payload: { x: 'general_callback', value: 1 } }
    expect(readX(barClickEvent)).toBe('general_callback')
  })

  it('reads the category from a Pie click, where it sits directly on the datum', () => {
    const pieClickEvent = { x: 'wrong_number', value: 3 }
    expect(readX(pieClickEvent)).toBe('wrong_number')
  })

  it('never mistakes the pixel x-coordinate for the category', () => {
    // no .payload at all, and the top-level x is a number — must not coerce it to a string
    const geometryOnly = { x: 214, y: 40 }
    expect(readX(geometryOnly)).toBeNull()
  })

  it('treats the empty-category sentinel as no filter, on either shape', () => {
    expect(readX({ payload: { x: '(empty)' } })).toBeNull()
    expect(readX({ x: '(empty)' })).toBeNull()
  })

  it('returns null for anything that is not a usable object', () => {
    expect(readX(null)).toBeNull()
    expect(readX(undefined)).toBeNull()
    expect(readX('general_callback')).toBeNull()
  })
})
