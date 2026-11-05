import { describe, it, expect } from 'vitest'
import { createQueryPlane, isCallDataTable, type Db } from '@/server/data-plane/adapters/queryPlane'
import { DestinationUnavailable } from '@/server/data-plane/errors'

/** A thenable query builder that records every call and resolves to `result`. */
function fakeDb(result: (log: string[]) => any = () => ({ data: [], error: null })) {
  const log: string[] = []
  const builder = (table: string): any =>
    new Proxy(() => {}, {
      get(_t, key: string) {
        if (key === 'then') return (res: any) => res(result(log))
        return (...args: unknown[]) => { log.push(`${table}.${key}(${args.map((a) => JSON.stringify(a)).join(',')})`); return builder(table) }
      },
    })
  const db = { from: (t: string) => builder(t), rpc: (fn: string, a: unknown) => { log.push(`rpc.${fn}`); return builder(fn) } }
  return { db: db as unknown as Db, log }
}

describe('queryPlane', () => {
  it('counts with eq for one agent, in for several, plus date and empty-json filters', async () => {
    const { db, log } = fakeDb(() => ({ count: 7, error: null }))
    const p = createQueryPlane(db, { typed: false })
    expect(await p.callData.countCallLogs({ agentIds: ['a'], from: '2026-01-01', emptyColumns: ['metrics'] })).toBe(7)
    expect(log).toContain('pype_voice_call_logs.eq("agent_id","a")')
    expect(log).toContain('pype_voice_call_logs.gte("created_at","2026-01-01")')
    expect(log).toContain('pype_voice_call_logs.or("metrics.is.null,metrics.eq.{}")')
    await p.callData.countCallLogs({ agentIds: ['a', 'b'] })
    expect(log).toContain('pype_voice_call_logs.in("agent_id",["a","b"])')
  })

  it('deletes per-turn rows by call log id before the logs, in pages', async () => {
    let page = 0
    const { db, log } = fakeDb((l) => {
      if (l.at(-1)?.endsWith('.select("id")') && !l.some((e) => e.includes('.delete(')) ) return { data: [{ id: 'c1' }, { id: 'c2' }], error: null }
      if (l.at(-1)?.endsWith('.limit(500)')) return { data: page++ === 0 ? [{ id: 'c1' }, { id: 'c2' }] : [], error: null }
      return { data: [{ id: 'c1' }], error: null }
    })
    await createQueryPlane(db, { typed: false }).callLogs.deleteCallDataForAgents(['a1'])
    const metrics = log.findIndex((e) => e.startsWith('pype_voice_metrics_logs.in("session_id",["c1","c2"])'))
    const logs = log.findIndex((e) => e.startsWith('pype_voice_call_logs.in("id",["c1","c2"])'))
    expect(metrics).toBeGreaterThan(-1)
    expect(logs).toBeGreaterThan(metrics)
    expect(log.some((e) => e.includes('session_id",["a1"]'))).toBe(false)
  })

  it('keeps the database message for Pype errors and types customer outages', async () => {
    const err = { error: { message: 'relation missing', code: '42P01' }, status: 500 }
    const pype = createQueryPlane(fakeDb(() => err).db, { typed: false })
    await expect(pype.callData.getCallLog('c', '*')).rejects.toThrow('relation missing')
    const customer = createQueryPlane(fakeDb(() => err).db, { typed: true, destination: 'acme' })
    await expect(customer.callData.getCallLog('c', '*')).rejects.toBeInstanceOf(DestinationUnavailable)
  })

  it('only exposes call-data tables through the generic read', async () => {
    const p = createQueryPlane(fakeDb().db, { typed: false })
    expect(isCallDataTable('pype_voice_agents')).toBe(false)
    await expect(p.callData.selectRows('pype_voice_agents', {})).rejects.toThrow('not call data')
  })
})
