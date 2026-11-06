import { describe, it, expect } from 'vitest'
import { Spec } from '@/server/analytics/spec'
import { runViaRpc } from '@/server/analytics/customerRun'
import { createFakePlane } from '@/server/data-plane/testing/fakePlane'
import type { Ctx } from '@/server/analytics/buildQuery'

const ctx: Ctx = { projectId: 'p', agentIds: ['a'], deniedFields: new Set(), tz: 'Asia/Kolkata', maxDays: 400, now: new Date('2026-11-06T06:00:00Z') }
const spec = Spec.parse({ spec_version: 1, agg: { fn: 'count' }, bucket: 'day', range: { days: 7 } })

describe('analytics_run on the customer plane', () => {
  it('sends the spec and context, and returns the in-memory path\'s row shape', async () => {
    const plane = createFakePlane()
    let sent: any
    plane.callData.analyticsRun = async (s, c) => { sent = { s, c }; return [{ bucket: '2026-11-06 00:00:00', value: '3', n_rows: 3, n_nonnull: '3' }] }
    const run = await runViaRpc(plane, spec, ctx)
    expect(sent.c).toEqual({ project_id: 'p', agent_ids: ['a'], tz: 'Asia/Kolkata', now: '2026-11-06T06:00:00.000Z' })
    expect(sent.s.agg.fn).toBe('count')
    expect(run!.rows).toEqual([{ bucket: '2026-11-06T00:00:00.000Z', value: 3, n_rows: 3, n_nonnull: 3 }])
    expect(run!.meta.bucket).toBe('day')
  })
  it('null when the function is not installed; other errors surface', async () => {
    const plane = createFakePlane()
    plane.callData.analyticsRun = async () => { throw Object.assign(new Error('nope'), { code: 'PGRST202' }) }
    expect(await runViaRpc(plane, spec, ctx)).toBeNull()
    plane.callData.analyticsRun = async () => { throw new Error('boom') }
    await expect(runViaRpc(plane, spec, ctx)).rejects.toThrow('boom')
  })
})
