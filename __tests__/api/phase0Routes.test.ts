import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Parity phase 0: ingest, send-logs, failure-report, reprocess and audio resolve the project server-side and fail closed.
const state = vi.hoisted(() => ({ agentProject: 'p1' as string | null, access: true }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'u1' }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: 'a@x.com' }] }),
}))
vi.mock('@/lib/getProjectRoleForApi', () => ({ getProjectRoleForApi: async () => (state.access ? { role: 'admin' } : null) }))
vi.mock('@/lib/auth', () => ({ verifyToken: async () => ({ valid: true, project_id: 'p1' }) }))
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      limit: () => chain,
      single: async () => ({ data: { field_extractor: false, id: 'p1' }, error: null }),
      maybeSingle: async () => ({ data: state.agentProject ? { project_id: state.agentProject, id: 'tok', token_hash: 'h' } : null }),
    }
    return { from: () => chain }
  },
}))

import { POST as ingestPOST } from '@/app/api/logs/call-logs/route'
import { POST as sendLogsPOST } from '@/app/api/send-logs/route'
import { POST as failurePOST } from '@/app/api/logs/failure-report/route'
import { POST as reprocessPOST } from '@/app/api/reprocess-call-logs/route'
import { POST as audioPOST } from '@/app/api/audio/route'
import { DestinationUnavailable } from '@/server/data-plane'
import { setDataPlaneResolverForTests } from '@/server/data-plane/resolver'
import { createFakePlane, type FakePlane } from '@/server/data-plane/testing/fakePlane'
import { createQueryPlane } from '@/server/data-plane/adapters/queryPlane'
import { fetchTranscriptTurnsForSessions } from '@/utils/callLogsUtils'

const req = (body: unknown, headers: Record<string, string> = {}) => {
  const text = JSON.stringify(body)
  return {
    json: async () => body,
    text: async () => text,
    url: 'http://x/api',
    headers: { get: (k: string) => ({ 'content-length': String(text.length), 'x-pype-token': 'tok', ...headers })[k.toLowerCase()] ?? null },
  } as any
}
const ENDED = { call_id: 'c1', agent_id: 'a1', customer_number: '+911', transcript_with_metrics: [{ turn_id: 'turn_1', user_transcript: 'hi' }], voice_recording_url: 'u' }

let customer: FakePlane
let pype: FakePlane
let held: boolean
let planeError: Error | null
beforeEach(() => {
  state.agentProject = 'p1'
  state.access = true
  held = true
  planeError = null
  customer = createFakePlane()
  pype = createFakePlane()
  setDataPlaneResolverForTests({
    forProject: async () => {
      if (planeError) throw planeError
      return held ? customer : pype
    },
    isCustomerHeld: async () => held,
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  setDataPlaneResolverForTests(null)
  vi.restoreAllMocks()
})

describe('worker ingest /api/logs/call-logs', () => {
  it('writes a customer-held call, its turns and project_id to the customer plane only', async () => {
    const res = await ingestPOST(req(ENDED))
    expect(res.status).toBe(200)
    expect(customer.rows.get('call_logs')?.[0]).toMatchObject({ call_id: 'c1', project_id: 'p1', agent_id: 'a1' })
    expect(customer.rows.get('turns')).toHaveLength(1)
    expect(pype.calls).toEqual([])
  })

  it('call_started inserts then updates on the same plane', async () => {
    await ingestPOST(req({ ...ENDED, wcall_event: 'call_started' }))
    await ingestPOST(req({ ...ENDED, wcall_event: 'call_started', customer_number: '+922' }))
    expect(customer.rows.get('call_logs')).toHaveLength(1)
    expect(customer.rows.get('call_logs')![0].customer_number).toBe('+922')
  })

  it('a route that cannot be used is a 503, never Pype', async () => {
    planeError = new DestinationUnavailable('acme')
    const res = await ingestPOST(req(ENDED))
    expect(res.status).toBe(503)
    expect(pype.calls).toEqual([])
  })

  it("refuses an agent of another project for a customer-held token", async () => {
    state.agentProject = 'other'
    const res = await ingestPOST(req(ENDED))
    expect(res.status).toBe(403)
    expect(customer.calls).toEqual([])
  })

  it('a Pype project still writes to the Pype plane', async () => {
    held = false
    state.agentProject = null
    const res = await ingestPOST(req(ENDED))
    expect(res.status).toBe(200)
    expect(pype.rows.get('call_logs')).toHaveLength(1)
    expect(customer.calls).toEqual([])
  })
})

describe('send-logs and failure-report payloads', () => {
  it('send-logs carries project_id and needs an agent for a customer-held project', async () => {
    const ok = await sendLogsPOST(req(ENDED))
    expect(ok.status).toBe(200)
    expect(customer.rows.get('call_logs')![0].project_id).toBe('p1')
    const { agent_id: _a, ...noAgent } = ENDED
    expect((await sendLogsPOST(req(noAgent))).status).toBe(400)
  })

  it('failure-report carries project_id and agent_id; customer-held needs the agent', async () => {
    const ok = await failurePOST(req({ token: 't', call_id: 'c1', agent_id: 'a1', error_message: 'boom' }))
    expect(ok.status).toBe(200)
    expect(customer.rows.get('call_logs')![0]).toMatchObject({ project_id: 'p1', agent_id: 'a1' })
    expect((await failurePOST(req({ token: 't', call_id: 'c2', error_message: 'boom' }))).status).toBe(400)
    state.agentProject = 'other'
    expect((await failurePOST(req({ token: 't', call_id: 'c3', agent_id: 'a1', error_message: 'boom' }))).status).toBe(403)
  })
})

describe('reprocess trigger', () => {
  const body = { from_date: '2026-01-01', to_date: '2026-01-02', reprocess_type: 'all', reprocess_options: 'both' }
  let fetched: any[]
  beforeEach(() => {
    fetched = []
    vi.stubGlobal('fetch', async (_u: string, init: any) => {
      fetched.push(JSON.parse(init.body))
      return { ok: true, json: async () => ({ ok: 1 }) }
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('needs a project hint, access, and a usable route; forwards the server-resolved project', async () => {
    expect((await reprocessPOST(req(body))).status).toBe(400)
    state.access = false
    expect((await reprocessPOST(req({ ...body, agent_id: 'a1' }))).status).toBe(403)
    state.access = true
    planeError = new DestinationUnavailable('acme')
    expect((await reprocessPOST(req({ ...body, agent_id: 'a1' }))).status).toBe(503)
    expect(fetched).toHaveLength(0)
    planeError = null
    expect((await reprocessPOST(req({ ...body, agent_id: 'a1', project_id: 'zzz' }))).status).toBe(400)
    expect((await reprocessPOST(req({ ...body, agent_id: 'a1' }))).status).toBe(200)
    expect(fetched[0]).toMatchObject({ agent_id: 'a1', project_id: 'p1' })
  })
})

describe('recording path derives the project server-side', () => {
  const PID = '11111111-1111-4111-8111-111111111111'
  beforeEach(() => {
    customer.storage.signRecordingUrl = async (k) => `https://signed/${k}`
  })

  it('signs a customer-held key with no agent hint', async () => {
    const res = await audioPOST({ json: async () => ({ s3Key: `recordings/${PID}/c1.ogg` }) } as any)
    expect(await res.json()).toMatchObject({ url: `https://signed/recordings/${PID}/c1.ogg`, routed: true })
  })

  it('refuses without access, and a key of another project than the agent', async () => {
    state.access = false
    expect((await audioPOST({ json: async () => ({ s3Key: `recordings/${PID}/c1.ogg` }) } as any)).status).toBe(403)
    state.access = true
    expect((await audioPOST({ json: async () => ({ s3Key: `recordings/${PID}/c1.ogg`, agentId: 'a1' }) } as any)).status).toBe(403)
  })
})

describe('customer schema v1 writes', () => {
  it('drops voice_recording_url on customer planes, keeps it on Pype', async () => {
    const seen: any[] = []
    const db: any = { from: () => ({ insert: (row: any) => (seen.push(row), { select: () => ({ single: async () => ({ data: row, error: null }) }) }) }) }
    await createQueryPlane(db, { typed: true }).callLogs.insertCallLog({ call_id: 'c', voice_recording_url: 'u' })
    await createQueryPlane(db, { typed: false }).callLogs.insertCallLog({ call_id: 'c', voice_recording_url: 'u' })
    expect(seen[0]).not.toHaveProperty('voice_recording_url')
    expect(seen[1]).toHaveProperty('voice_recording_url', 'u')
  })
})

describe('CSV transcript fetch', () => {
  it('fails the export instead of dropping a chunk of transcripts', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 503 }))
    await expect(fetchTranscriptTurnsForSessions('a1', ['s1'])).rejects.toThrow(/Transcript fetch failed/)
    vi.unstubAllGlobals()
  })
})
