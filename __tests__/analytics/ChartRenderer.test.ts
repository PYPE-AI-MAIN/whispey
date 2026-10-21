/**
 * A bar click resolving to the wrong thing looks exactly like the drill-through
 * silently matching nothing — "N calls became 0 rows" — while the tooltip right
 * next to it shows the correct name, since it reads a separate code path.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChartRenderer, drillTarget, readX, seriesColor, SERIES_COLORS, timeTickInterval } from '@/components/analytics/ChartRenderer'

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

describe('spacing time-axis ticks so a long series is still readable', () => {
  it('shows every tick when there are few enough already', () => {
    expect(timeTickInterval(5)).toBe(0)
    expect(timeTickInterval(10)).toBe(0)
  })

  it('skips down to roughly 10 labels for a long daily series', () => {
    // 90 daily buckets at interval=0 is 90 overlapping date labels
    expect(timeTickInterval(90)).toBe(8)
  })

  it('respects a custom max', () => {
    expect(timeTickInterval(20, 5)).toBe(3)
  })
})

describe('what a bar click drills into', () => {
  const bar = { x: 120, payload: { x: '2026-10-15T18:30:00.000Z', booked: 3 } }

  it('is the value itself on a category chart', () => {
    expect(drillTarget({ payload: { x: 'booked' } }, 'category')).toEqual({ value: 'booked' })
  })

  it('is the time bucket, not a value, on a chart over time', () => {
    expect(drillTarget(bar, 'time', 'value')).toEqual({ bucket: '2026-10-15T18:30:00.000Z' })
  })

  it('adds the stacked segment that was clicked', () => {
    expect(drillTarget(bar, 'time', 'booked')).toEqual({ value: 'booked', bucket: '2026-10-15T18:30:00.000Z' })
    expect(drillTarget(bar, 'time', '(empty)')).toEqual({ value: null, bucket: '2026-10-15T18:30:00.000Z' })
  })

  it('opens the whole bucket for the folded (other) segment', () => {
    expect(drillTarget(bar, 'time', '(other)')).toEqual({ bucket: '2026-10-15T18:30:00.000Z' })
  })
})

describe('series colours', () => {
  it('never gives two of the first twelve values the same colour', () => {
    expect(SERIES_COLORS).toHaveLength(12)
    const used = Array.from({ length: 12 }, (_, i) => seriesColor(`v${i}`, i))
    expect(new Set(used).size).toBe(12)
  })

  it('draws catch-all series, and anything past twelve, in the neutral grey', () => {
    expect(seriesColor('(other)', 0)).toBe('var(--analytics-series-other)')
    expect(seriesColor('(empty)', 3)).toBe('var(--analytics-series-other)')
    expect(seriesColor('v13', 12)).toBe('var(--analytics-series-other)')
  })
})

describe('the day-by-value table', () => {
  const spec = { spec_version: 1, agg: { fn: 'count' }, bucket: 'day', dimension: { field: { col: 'metadata', path: ['d'] } }, range: { days: 7 }, display: { round: 0 } } as never
  const rows = [
    { bucket: '2026-10-15T18:30:00.000Z', series: 'warm', value: 9 },
    { bucket: '2026-10-15T18:30:00.000Z', series: 'booked', value: 1 },
    { bucket: '2026-10-16T18:30:00.000Z', series: 'warm', value: 12 },
    { bucket: '2026-10-16T18:30:00.000Z', series: 'booked', value: 4 },
  ] as never
  const html = renderToStaticMarkup(createElement(ChartRenderer, { kind: 'table', rows, spec, bucket: 'day', onSelect: () => {} }))

  it('has a Total column and a Total row that add up', () => {
    expect(html).toContain('>Total<')
    expect(html).toContain('>10<') // Oct 15: 9 + 1
    expect(html).toContain('>16<') // Oct 16: 12 + 4
    expect(html).toContain('>26<') // everything
  })

  it('puts the biggest column first', () => {
    expect(html.indexOf('warm')).toBeLessThan(html.indexOf('booked'))
  })
})
