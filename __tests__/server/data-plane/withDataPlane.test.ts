import { describe, it, expect, afterEach } from 'vitest'
import { withDataPlane } from '@/server/data-plane/withDataPlane'
import { setDataPlaneResolverForTests } from '@/server/data-plane/resolver'
import { DestinationUnavailable, RouteInMaintenance, DestinationIncompatible } from '@/server/data-plane/errors'
import { createFakePlane } from '@/server/data-plane/testing/fakePlane'

afterEach(() => setDataPlaneResolverForTests(null))

describe('withDataPlane', () => {
  it('passes the plane source to the handler', async () => {
    const fake = createFakePlane({ call_logs: [{ id: 'c1', agent_id: 'a1' }] })
    setDataPlaneResolverForTests({ forProject: async () => fake })
    const route = withDataPlane(async (dp, _req: unknown) => {
      const plane = await dp.forProject('p1')
      return Response.json({ n: await plane.callData.countCallLogs({ agentIds: ['a1'] }) })
    })
    expect(await (await route({})).json()).toEqual({ n: 1 })
  })

  it.each([
    ['unavailable', new DestinationUnavailable('acme'), 'destination_unavailable'],
    ['maintenance', new RouteInMaintenance('p1', 'call_data'), 'route_in_maintenance'],
    ['incompatible', new DestinationIncompatible('acme', 'bad'), 'destination_incompatible'],
  ])('maps %s to HTTP 503', async (_n, err, code) => {
    setDataPlaneResolverForTests({ forProject: async () => { throw err } })
    const res = await withDataPlane(async (dp, _req: unknown) => { await dp.forProject('p1'); return Response.json({}) })({})
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code, retryable: true })
  })

  it('lets other errors through', async () => {
    await expect(withDataPlane(async (_dp, _req: unknown) => { throw new Error('bug') })({})).rejects.toThrow('bug')
  })
})
