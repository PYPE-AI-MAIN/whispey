/**
 * The math behind a "Percentage" card — two ordinary chart results divided
 * server-side, after buildQuery has already run both. `combineFormula` is
 * where a redundant "Only counting" filter turned into a silent blank dash
 * for a normal `rate` chart (see the dashboard route's own history); the
 * whole point of this path is that division only happens once, here, so it
 * can be gotten right in one place.
 */
import { describe, expect, it } from 'vitest'
import { asFormulaSpec, combineFormula, type WidgetResult } from '@/server/analytics/formula'

const ok = (value: number | null): WidgetResult => ({ widget_id: 'x', status: 'ok', data: [{ value, n_rows: 0, n_nonnull: 0 }] })

describe('asFormulaSpec', () => {
  it('recognizes a formula spec', () => {
    expect(asFormulaSpec({ a: {}, b: {}, op: 'percent' })).toEqual({ a: {}, b: {}, op: 'percent' })
  })
  it('rejects an ordinary chart spec', () => {
    expect(asFormulaSpec({ spec_version: 1, agg: { fn: 'count' } })).toBeNull()
  })
  it('rejects a text block', () => {
    expect(asFormulaSpec({ text: 'hello' })).toBeNull()
  })
})

describe('combineFormula', () => {
  const f = { id: 'w1', aId: 'w1::a', bId: 'w1::b' } as const

  it('percent: A as a % of B', () => {
    const results = new Map([[f.aId, ok(150)], [f.bId, ok(500)]])
    expect(combineFormula({ ...f, op: 'percent' }, results)).toEqual({ widget_id: 'w1', status: 'ok', data: [{ value: 30 }] })
  })

  it('ratio: plain division, no ×100', () => {
    const results = new Map([[f.aId, ok(9)], [f.bId, ok(3)]])
    expect(combineFormula({ ...f, op: 'ratio' }, results)).toEqual({ widget_id: 'w1', status: 'ok', data: [{ value: 3 }] })
  })

  it('B = 0 is a blank card, not a divide-by-zero crash', () => {
    const results = new Map([[f.aId, ok(5)], [f.bId, ok(0)]])
    expect(combineFormula({ ...f, op: 'percent' }, results)).toEqual({ widget_id: 'w1', status: 'ok', data: [{ value: null }] })
  })

  it('a failed side fails the whole card, not a wrong number', () => {
    const results = new Map<string, WidgetResult>([
      [f.aId, { widget_id: f.aId, status: 'error', error: 'This chart needs fixing in its settings' }],
      [f.bId, ok(500)],
    ])
    expect(combineFormula({ ...f, op: 'percent' }, results)).toEqual({
      widget_id: 'w1',
      status: 'error',
      error: 'This chart needs fixing in its settings',
    })
  })

  it('a missing side (never ran) is an error, not a silent zero', () => {
    const results = new Map([[f.bId, ok(500)]])
    const out = combineFormula({ ...f, op: 'percent' }, results)
    expect(out.status).toBe('error')
  })
})
