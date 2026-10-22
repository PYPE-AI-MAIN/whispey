import { describe, it, expect, vi } from 'vitest'
import { runCallVolumeTrend, runCompletionInsights, PI_MANDATORY_ANALYTICS_TOOLS_DOC } from '@/lib/piAnalyticsTools'

const ok = (data: unknown) => ({ success: true, result: { data } })

describe('runCallVolumeTrend', () => {
  it('clamps days to 1..90 and asks for a daily count over that range', async () => {
    const query = vi.fn().mockResolvedValue(ok([]))
    await runCallVolumeTrend('P', query, { days: 500 })
    await runCallVolumeTrend('P', query, { days: 0 })
    await runCallVolumeTrend('P', query, {})
    expect(query.mock.calls.map((c) => c[1].spec.range.days)).toEqual([90, 1, 30])
    expect(query.mock.calls[0][1].spec).toMatchObject({ source: 'voice', agg: { fn: 'count' }, bucket: 'day' })
  })

  it('summarises totals, daily average and the direction of the trend', async () => {
    const rows = (counts: number[]) => counts.map((value, i) => ({ bucket: `2026-09-0${i + 1}T00:00:00Z`, value }))
    const run = async (counts: number[]) => (await runCallVolumeTrend('P', vi.fn().mockResolvedValue(ok(rows(counts))), { days: 7 })).result as any
    // 80 calls over a 7-day period = 11/day: days with no rows still count
    const up = await run([10, 10, 30, 30])
    expect(up).toMatchObject({ total_calls: 80, avg_per_day: 11, trend: 'up', period_days: 7 })
    expect(up.daily[0]).toEqual({ day: '2026-09-01', count: 10 })
    expect((await run([30, 30, 10, 10])).trend).toBe('down')
    expect((await run([20, 20, 20, 20])).trend).toBe('flat')
  })

  it('ignores rows without a bucket or value and handles no data', async () => {
    const res = (await runCallVolumeTrend('P', vi.fn().mockResolvedValue(ok([{ bucket: null, value: 5 }, { bucket: '2026-09-01', value: null }])), {})).result as any
    expect(res).toMatchObject({ total_calls: 0, avg_per_day: 0, trend: 'flat', daily: [] })
  })

  it('passes a failed query straight through', async () => {
    const failed = { success: false, result: { error: 'boom' } }
    expect(await runCallVolumeTrend('P', vi.fn().mockResolvedValue(failed), {})).toBe(failed)
  })
})

describe('runCompletionInsights', () => {
  const field = (over: Record<string, unknown>) => ({ col: 'transcription_metrics', path: ['x'], label: 'x', coverage_pct: 50, ...over })

  it('picks completion-style fields by name or description, best coverage first, max 5', async () => {
    const fields = [
      field({ label: 'goal_achieved', coverage_pct: 40 }),
      field({ label: 'sentiment', coverage_pct: 99 }),
      field({ label: 'status', description: 'did the patient confirm the appointment (task complete)', coverage_pct: 90 }),
      ...['call_outcome', 'is_resolved', 'task_done', 'success_flag'].map((label, i) => field({ label, coverage_pct: 10 + i })),
    ]
    const query = vi.fn().mockResolvedValue(ok([{ value: 0.5, n_rows: 10 }]))
    const out = await runCompletionInsights('P', query, vi.fn().mockResolvedValue({ success: true, result: { fields } }), {})
    const labels = (out.result as any).completion_metrics.map((m: any) => m.label)
    expect(labels).toHaveLength(5)
    expect(labels[0]).toBe('status') // highest coverage among completion-like fields
    expect(labels).not.toContain('sentiment')
  })

  it('turns a rate into a percentage with one decimal and keeps the boolean encoding', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce(ok([{ value: 120 }])) // volume
      .mockResolvedValueOnce(ok([{ value: 0.8765, n_rows: 33 }])) // rate
    const out = await runCompletionInsights('P', query, vi.fn().mockResolvedValue({ success: true, result: { fields: [field({ label: 'goal_achieved', boolean_encoding: 'yes_no' })] } }), { days: 14 })
    expect(out.result).toMatchObject({ period_days: 14, total_calls: 120, completion_metrics: [{ label: 'goal_achieved', rate_pct: 87.7, n_rows: 33 }] })
    expect(query.mock.calls[1][1].spec.agg.field).toMatchObject({ boolean_encoding: 'yes_no' })
  })

  it('skips a failed rate query, returns a null rate when there is no value, and explains an empty result', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce(ok([{ value: 5 }]))
      .mockResolvedValueOnce({ success: false, result: {} })
      .mockResolvedValueOnce(ok([{ n_rows: 1 }]))
    const out = await runCompletionInsights('P', query, vi.fn().mockResolvedValue({ success: true, result: { fields: [field({ label: 'goal_a' }), field({ label: 'goal_b', path: undefined })] } }), {})
    expect((out.result as any).completion_metrics).toEqual([{ label: 'goal_b', field: { col: 'transcription_metrics' }, rate_pct: null, n_rows: 1 }])

    const none = await runCompletionInsights('P', vi.fn().mockResolvedValue(ok([{ value: 2 }])), vi.fn().mockResolvedValue({ success: true, result: { fields: [] } }), {})
    expect((none.result as any).note).toContain('No completion-style extractor fields')
  })

  it('reports no total when the volume query fails, and passes a field-listing failure through', async () => {
    const out = await runCompletionInsights('P', vi.fn().mockResolvedValue({ success: false, result: {} }), vi.fn().mockResolvedValue({ success: true, result: { fields: [] } }), {})
    expect((out.result as any).total_calls).toBeNull()
    const failed = { success: false, result: { error: 'x' } }
    expect(await runCompletionInsights('P', vi.fn(), vi.fn().mockResolvedValue(failed), {})).toBe(failed)
  })
})

describe('tool guidance doc', () => {
  it('names the mandatory tools Pi must use', () => {
    expect(PI_MANDATORY_ANALYTICS_TOOLS_DOC).toContain('get_call_volume_trend')
    expect(PI_MANDATORY_ANALYTICS_TOOLS_DOC).toContain('get_completion_insights')
  })
})
