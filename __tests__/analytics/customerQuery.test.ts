import { describe, it, expect } from 'vitest'
import { Spec } from '@/server/analytics/spec'
import { STARTER_CHARTS } from '@/server/analytics/starterCharts'
import { assertSupported, aggregateCustomerRows } from '@/server/analytics/customerQuery'
import type { Ctx } from '@/server/analytics/buildQuery'

const ctx: Ctx = { projectId: 'p', agentIds: ['a'], deniedFields: new Set(), tz: 'Asia/Kolkata', maxDays: 400, now: new Date('2026-11-06T06:00:00Z') }
const call = (started: string, over: Record<string, unknown> = {}) => ({
  agent_id: 'a', call_started_at: started, call_ended_at: null, call_ended_reason: 'completed', wcall_event: 'call_ended',
  avg_latency: 1, total_llm_cost: 1, total_tts_cost: 0.5, total_stt_cost: null, ...over,
})
const rows = [
  call('2026-11-06T01:00:00', { call_ended_at: '2026-11-06T01:02:00', avg_latency: 1 }),
  call('2026-11-06T02:00:00', { call_ended_reason: 'customer-ended', avg_latency: 3 }),
  call('2026-11-05T20:00:00', { call_ended_reason: 'completed', avg_latency: 2 }), // 06 Nov 01:30 IST
  call('2026-11-06T03:00:00', { wcall_event: 'call_started', call_ended_reason: null }),
  call('2026-09-01T00:00:00'),
]
const run = (title: string) => {
  const spec = Spec.parse(STARTER_CHARTS.find((c) => c.title === title)!.spec)
  assertSupported(spec, ctx)
  return aggregateCustomerRows(rows, spec, ctx).rows
}

describe('customer analytics aggregator', () => {
  it('answers every starter chart', () => {
    for (const c of STARTER_CHARTS) assertSupported(Spec.parse(c.spec), ctx)
  })
  it('counts ended calls only, in range', () => {
    expect(run('Total calls')).toEqual([{ value: 3, n_rows: 3, n_nonnull: 3 }])
    expect(run('Completed calls')[0].value).toBe(2)
    expect(run('Incomplete calls')[0].value).toBe(1)
  })
  it('counts live calls when asked', () => {
    expect(run('Live calls')[0].value).toBe(1)
  })
  it('sums cost with null parts as zero and avg ignores nulls', () => {
    expect(run('Total cost')[0].value).toBe(4.5)
    expect(run('Response time')[0].value).toBe(2)
  })
  it('buckets by the project wall clock and sorts', () => {
    const r = run('Daily call volume')
    expect(r.map((x) => [x.bucket, x.value])).toEqual([['2026-11-06T00:00:00.000Z', 3]])
  })
  it('breaks down by reason, biggest first', () => {
    expect(run('Why calls ended').map((x) => [x.series, x.value])).toEqual([['completed', 2], ['customer-ended', 1]])
  })
  it('p95 interpolates like percentile_cont', () => {
    expect(run('Latency spread')[0].value).toBeCloseTo(2.9)
  })
  it('refuses what it cannot answer exactly', () => {
    const bad = Spec.parse({ spec_version: 1, agg: { fn: 'count' }, range: { days: 7 }, having: [{ field: { col: 'metadata', path: ['x'] }, op: 'eq', value: '1' }] })
    expect(() => assertSupported(bad, ctx)).toThrow(/not available/)
    const denied = Spec.parse({ spec_version: 1, agg: { fn: 'sum', field: { col: 'total_cost' } }, range: { days: 7 } })
    expect(() => assertSupported(denied, { ...ctx, deniedFields: new Set(['total_cost']) })).toThrow(/no permission/)
  })
})
