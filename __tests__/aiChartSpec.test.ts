import { describe, it, expect } from 'vitest'
import { extractAllJsonFences } from '@/lib/jsonFence'
import { extractChartJsons, validateAiChart } from '@/components/analytics/aiChartSpec'

const fence = (obj: unknown) => '```json\n' + JSON.stringify(obj) + '\n```'

describe('extractAllJsonFences', () => {
  it('returns every complete block in order', () => {
    const text = `Two charts. ${fence({ a: 1 })} and ${fence({ b: 2 })}`
    expect(extractAllJsonFences(text)).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('skips an unparseable block and an unfinished one', () => {
    const text = '```json\nnot json\n``` then ' + fence({ ok: true }) + ' then ```json\n{"half":'
    expect(extractAllJsonFences(text)).toEqual([{ ok: true }])
  })

  it('returns nothing for plain text', () => {
    expect(extractChartJsons('just an answer')).toEqual([])
  })
})

describe('validateAiChart', () => {
  it('rejects a chart with no title, an unknown type, or no definition', () => {
    expect(validateAiChart({ kind: 'bar', spec: {} }, [])).toEqual({ ok: false, error: 'missing a title' })
    expect(validateAiChart({ title: 'x', kind: 'radar', spec: {} }, [])).toMatchObject({ ok: false })
    expect(validateAiChart({ title: 'x', kind: 'bar' }, [])).toEqual({ ok: false, error: 'missing a chart definition' })
  })

  it('accepts a plain count and forces per-call grain', () => {
    const res = validateAiChart({ title: 'Total calls', kind: 'kpi', spec: { agg: { fn: 'count' } } }, [])
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.chart.spec.grain).toBe('interaction')
  })
})
