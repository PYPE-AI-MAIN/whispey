import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client, types } from 'pg'
import { Spec, type SpecInput } from '@/server/analytics/spec'
import { buildQuery, type Ctx } from '@/server/analytics/buildQuery'
import { aggregateCustomerRows, drillCustomerRows } from '@/server/analytics/customerQuery'

/**
 * Parity: the in-memory evaluator (customer-held projects) against Pype's own SQL (buildQuery) on the same
 * rows. Needs a Postgres with the customer schema's `api.pype_voice_call_logs` (the docker customer stack):
 *   PARITY_PG_URL=postgres://postgres:...@127.0.0.1:54329/pype npx vitest run __tests__/analytics/customerParity.live.test.ts
 * It creates a throwaway schema and drops it afterwards.
 */
const URL = process.env.PARITY_PG_URL
const SCHEMA = `parity_${process.pid}`
const A = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']
const ctx: Ctx = { projectId: '99999999-9999-4999-8999-999999999999', agentIds: A, deniedFields: new Set(), tz: 'Asia/Kolkata', maxDays: 730, now: new Date('2026-11-06T06:00:00Z') }

function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fixture(n: number): Record<string, unknown>[] {
  const rnd = prng(42)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
  const phones = Array.from({ length: 40 }, (_, i) => String(9000000000 + i * 137))
  const fmt = (d: string) => pick([`+91${d}`, `91${d}`, `+91-${d}`, d])
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < n; i++) {
    const started = new Date(Date.parse('2026-10-05T00:00:00Z') + Math.floor(rnd() * 33 * 86400_000))
    const ended = rnd() < 0.1 ? null : new Date(started.getTime() + Math.floor(rnd() * 400_000) - (rnd() < 0.05 ? 500_000 : 0))
    const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 19) : null)
    const items = Array.from({ length: Math.floor(rnd() * 4) }, () => ({ name: pick(['scan', 'xray', 'blood', 'mri']), qty: Math.floor(rnd() * 3) + 1 }))
    const bad = rnd() < 0.1
    rows.push({
      id: `${(1e7 + i).toString(16).padStart(8, '0')}-0000-4000-8000-${String(i).padStart(12, '0')}`,
      call_id: `call-${i}`,
      agent_id: pick(A),
      project_id: ctx.projectId,
      customer_number: rnd() < 0.05 ? `web-session-${'x'.repeat(40)}${i % 3}` : fmt(pick(phones)),
      call_ended_reason: pick(['completed', 'completed', 'customer-ended', 'transfer_failed', 'error', null]),
      transcript_type: pick(['voice', 'voice', 'chat', null]),
      environment: pick(['prod', 'prod', 'dev', '']),
      wcall_event: rnd() < 0.08 ? 'call_started' : 'call_ended',
      call_started_at: iso(started),
      call_ended_at: iso(ended),
      created_at: iso(new Date(started.getTime() + Math.floor(rnd() * 5) * 1000)),
      duration_seconds: rnd() < 0.2 ? Math.floor(rnd() * 300) : null,
      billing_duration_seconds: rnd() < 0.85 ? Math.round(rnd() * 3000) / 10 : null,
      avg_latency: rnd() < 0.9 ? Math.round(rnd() * 4000) / 1000 : null,
      total_llm_cost: rnd() < 0.8 ? Math.round(rnd() * 100) / 100 : null,
      total_tts_cost: rnd() < 0.8 ? Math.round(rnd() * 50) / 100 : null,
      total_stt_cost: rnd() < 0.5 ? Math.round(rnd() * 20) / 100 : null,
      metadata: {
        appointment_id: pick(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', ' a7 ', '', 'N/A', null, '-']),
        disposition: pick(['Booked', 'booked', 'Cancelled', 'Rescheduled', 'No answer', 'Callback', 'Other1', 'Other2', '-', null, 'n/a']),
        confirmed: pick(['yes', 'No', 'YES', 'no', '1', '0', 'true', null, 'N/A']),
        score: pick(['45%', '7.5', 7, '1,200', '12', 3.25, null, '-5', '1e2']),
        items,
        items_str: bad ? '[object Object]' : JSON.stringify(items),
        nested: { a: { b: pick(['z', 'y', null]) }, list: [1, 2] },
        obj: { b: 1, aa: 'x', a: [true, null] },
        phone: fmt(pick(phones)),
      },
      transcription_metrics: { is_confirmation: pick(['1', '0', 1, 0, null, 'N/A']), final_disposition: pick(['A', 'B', 'a', null]) },
      metrics: rnd() < 0.5 ? { is_task_complete: pick(['true', 'false', true, false]) } : null,
      dynamic_variables: rnd() < 0.5 ? { lang: pick(['hi', 'en']) } : null,
    })
  }
  return rows
}

const SP = (over: Record<string, unknown>): SpecInput => ({ spec_version: 1, agg: { fn: 'count' }, range: { days: 30 }, ...over }) as SpecInput
const M = (path: string[], extra: Record<string, unknown> = {}) => ({ col: 'metadata', path, ...extra })
const completed = { field: { col: 'call_ended_reason' }, op: 'eq', value: 'completed' }
const ranking = ['Booked', 'booked', 'Rescheduled', 'Cancelled', 'No answer']

const CASES: Record<string, SpecInput> = {
  count: SP({}),
  'count over 400 days': SP({ range: { days: 400 } }),
  'count_distinct callee': SP({ agg: { fn: 'count_distinct', field: { col: 'customer_number' } } }),
  'count_distinct callee having completed': SP({ agg: { fn: 'count_distinct', field: { col: 'customer_number' } }, having: [completed] }),
  'count_distinct by agent': SP({ agg: { fn: 'count_distinct', field: { col: 'customer_number' } }, dimension: { field: { col: 'agent_id' } } }),
  'count_distinct json phone': SP({ agg: { fn: 'count_distinct', field: M(['phone']) } }),
  'count_distinct text field': SP({ agg: { fn: 'count_distinct', field: M(['appointment_id']) } }),
  sum_ceil_minutes: SP({ agg: { fn: 'sum_ceil_minutes', field: { col: 'billing_duration_seconds' } } }),
  'sum_ceil_minutes by agent': SP({ agg: { fn: 'sum_ceil_minutes', field: { col: 'billing_duration_seconds' } }, dimension: { field: { col: 'agent_id' } } }),
  'avg latency by agent': SP({ agg: { fn: 'avg', field: { col: 'avg_latency' } }, dimension: { field: { col: 'agent_id' } } }),
  'sum total_cost': SP({ agg: { fn: 'sum', field: { col: 'total_cost' } } }),
  'min/max call duration': SP({ agg: { fn: 'max', field: { col: 'call_duration_seconds' } } }),
  stddev: SP({ agg: { fn: 'stddev', field: { col: 'avg_latency' } } }),
  p50: SP({ agg: { fn: 'p50', field: { col: 'avg_latency' } } }),
  p90: SP({ agg: { fn: 'p90', field: { col: 'billing_duration_seconds' } } }),
  'sum json number guard': SP({ agg: { fn: 'sum', field: M(['score']) } }),
  'avg json number by day': SP({ agg: { fn: 'avg', field: M(['score']) }, bucket: 'day' }),
  'rate yes_no': SP({ agg: { fn: 'rate', field: M(['confirmed'], { boolean_encoding: 'yes_no' }) } }),
  'rate one_zero all_rows': SP({ agg: { fn: 'rate', field: { col: 'transcription_metrics', path: ['is_confirmation'], boolean_encoding: 'one_zero' }, denominator: 'all_rows' } }),
  'rate false match': SP({ agg: { fn: 'rate', field: { col: 'metrics', path: ['is_task_complete'], boolean_encoding: 'true_false' }, match: false } }),
  'dimension disposition': SP({ dimension: { field: M(['disposition']) } }),
  'dimension include_empty case_insensitive': SP({ dimension: { field: M(['disposition']), include_empty: true, case_insensitive: true } }),
  'dimension limit 3': SP({ dimension: { field: M(['disposition']), limit: 3 } }),
  'bucket day + dimension top 3': SP({ bucket: 'day', dimension: { field: M(['disposition']), limit: 3 } }),
  'bucket week': SP({ bucket: 'week' }),
  'bucket month 300d': SP({ bucket: 'month', range: { days: 300 } }),
  'bucket hour 2d': SP({ bucket: 'hour', range: { days: 2 } }),
  'bucket auto': SP({ bucket: 'auto' }),
  'range from/to': SP({ range: { from: '2026-10-10', to: '2026-10-20' }, bucket: 'day' }),
  'time of day': SP({ time_of_day: { from: '09:00', to: '17:00' } }),
  'time of day night shift': SP({ time_of_day: { from: '22:00', to: '02:00' }, bucket: 'day' }),
  'days of week': SP({ days_of_week: [1, 2, 7] }),
  'exclude environments': SP({ exclude_environments: ['dev'] }),
  'live calls': SP({ include_live_calls: true }),
  'filters contains/starts_with': SP({ filters: [{ field: M(['disposition']), op: 'contains', value: 'book' }, { field: M(['appointment_id']), op: 'starts_with', value: 'A' }] }),
  'filters in/not_in/is_empty': SP({ filters: [{ field: { col: 'environment' }, op: 'in', value: ['prod', 'dev'] }, { field: M(['disposition']), op: 'not_in', value: ['Other1'] }, { field: M(['appointment_id']), op: 'is_not_empty' }] }),
  'filters is_empty': SP({ filters: [{ field: M(['appointment_id']), op: 'is_empty' }] }),
  'filters wildcard like': SP({ filters: [{ field: M(['disposition']), op: 'contains', value: 'Oth_r%' }] }),
  'filters numeric gt json': SP({ filters: [{ field: M(['score']), op: 'gt', value: 5 }] }),
  'filters numeric lte column': SP({ filters: [{ field: { col: 'avg_latency' }, op: 'lte', value: 1.5 }] }),
  'filters is_true / is_false': SP({ filters: [{ field: M(['confirmed'], { boolean_encoding: 'yes_no' }), op: 'is_true' }] }),
  'filters or-group': SP({ filters: [{ op: 'or', children: [{ field: { col: 'call_ended_reason' }, op: 'eq', value: 'error' }, { op: 'and', children: [{ field: { col: 'environment' }, op: 'eq', value: 'dev' }, { field: M(['disposition']), op: 'neq', value: 'Booked' }] }] }] }),
  'filters eq numeric column': SP({ filters: [{ field: { col: 'duration_seconds' }, op: 'eq', value: 5 }] }),
  'having json object text': SP({ having: [{ field: M(['obj']), op: 'contains', value: '"aa"' }] }),
  'dimension json nested': SP({ dimension: { field: M(['nested', 'a', 'b']) } }),
  'dimension json array text': SP({ dimension: { field: M(['nested', 'list']) } }),
  'dimension json index path': SP({ dimension: { field: M(['nested', 'list', '1']) } }),
  'dynamic variables dimension': SP({ dimension: { field: { col: 'dynamic_variables', path: ['lang'] } } }),
  'entity best_outcome': SP({
    grain: 'entity',
    dedupe: { key: { field: M(['appointment_id']), fallback: 'none' }, winner: 'best_outcome', outcome: M(['disposition']), ranking_ref: 'inline', ranking, lookback_days: 20 },
    dimension: { field: M(['disposition']) },
  }),
  'entity most_recent answered': SP({
    grain: 'entity',
    dedupe: { key: { field: { col: 'customer_number' }, fallback: 'call_id' }, winner: 'most_recent', answered_only: true, lookback_days: 30 },
    agg: { fn: 'count_distinct', field: { col: 'customer_number' } },
  }),
  'entity first': SP({ grain: 'entity', dedupe: { key: { field: M(['appointment_id']), fallback: 'call_id' }, winner: 'first', lookback_days: 10 }, bucket: 'day' }),
  'entity with filters+having': SP({
    grain: 'entity', range: { days: 10 },
    dedupe: { key: { field: { col: 'customer_number' }, fallback: 'call_id' }, winner: 'best_outcome', outcome: M(['disposition']), ranking_ref: 'inline', ranking, lookback_days: 30 },
    filters: [{ field: { col: 'environment' }, op: 'neq', value: 'dev' }], having: [completed],
  }),
  'element count by name': SP({ grain: 'element', element_source: M(['items']), dimension: { field: { col: 'element', path: ['name'] } } }),
  'element sum qty': SP({ grain: 'element', element_source: M(['items']), agg: { fn: 'sum', field: { col: 'element', path: ['qty'] } } }),
  'element having': SP({ grain: 'element', element_source: M(['items']), having: [{ field: { col: 'element', path: ['qty'] }, op: 'gte', value: 2 }], bucket: 'day' }),
  'element json_string': SP({ grain: 'element', element_source: M(['items_str'], { encoding: 'json_string' }), dimension: { field: { col: 'element', path: ['name'] } } }),
  'element on entity': SP({
    grain: 'element', element_source: M(['items']), dimension: { field: { col: 'element', path: ['name'] } },
  }),
  'count by agent+hour': SP({ range: { days: 3 }, bucket: 'hour', dimension: { field: { col: 'agent_id' } } }),
}

const DRILLS: Record<string, { spec: SpecInput; opts?: { dimensionValue?: string | null; bucketValue?: string } }> = {
  all: { spec: SP({}) },
  'completed only': { spec: SP({ having: [completed] }) },
  'one bar': { spec: SP({ dimension: { field: { col: 'agent_id' } } }), opts: { dimensionValue: A[1] } },
  'empty bucket': { spec: SP({ dimension: { field: M(['disposition']), include_empty: true } }), opts: { dimensionValue: null } },
  'one day': { spec: SP({ bucket: 'day' }), opts: { bucketValue: '2026-10-20 00:00:00' } },
  entity: { spec: SP({ grain: 'entity', dedupe: { key: { field: { col: 'customer_number' }, fallback: 'call_id' }, winner: 'most_recent', lookback_days: 30 } }) },
}

const close = (a: unknown, b: unknown) => {
  if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null)
  const x = Number(a)
  const y = Number(b)
  return Math.abs(x - y) <= 1e-7 * Math.max(1, Math.abs(x), Math.abs(y))
}

const norm = (rows: Record<string, any>[]) =>
  rows
    .map((r) => ({
      bucket: r.bucket === undefined ? undefined : String(r.bucket).replace('T', ' ').replace('.000Z', ''),
      series: r.series === undefined ? undefined : r.series,
      value: r.value === null || r.value === undefined ? null : Number(r.value),
      n_rows: Number(r.n_rows),
      n_nonnull: Number(r.n_nonnull),
    }))
    .sort((a, b) => String(a.bucket ?? '').localeCompare(String(b.bucket ?? '')) || String(a.series ?? '\u0000').localeCompare(String(b.series ?? '\u0000')))

describe.skipIf(!URL)('customer evaluator = Pype SQL', () => {
  let db: Client
  let rows: Record<string, unknown>[]
  const pgQuery = async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows

  beforeAll(async () => {
    db = new Client({ connectionString: URL, types: { getTypeParser: (oid: number, fmt?: any) => (oid === 1114 || oid === 1184 || oid === 1700 || oid === 20 ? (v: string) => (oid === 1114 || oid === 1184 ? v : Number(v)) : types.getTypeParser(oid, fmt)) } as any })
    await db.connect()
    await db.query(`CREATE SCHEMA ${SCHEMA}`)
    await db.query(`CREATE TABLE ${SCHEMA}.pype_voice_call_logs (LIKE api.pype_voice_call_logs INCLUDING DEFAULTS)`)
    rows = fixture(500)
    for (const r of rows) {
      const cols = Object.keys(r)
      await db.query(
        `INSERT INTO ${SCHEMA}.pype_voice_call_logs (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
        cols.map((c) => (r[c] !== null && typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c]))
      )
    }
    // the rows exactly as PostgREST would deliver them
    rows = (await db.query(`SELECT to_jsonb(t) AS j FROM ${SCHEMA}.pype_voice_call_logs t`)).rows.map((r) => r.j)
    await db.query(`SET search_path TO ${SCHEMA}`)
    await db.query(`SET TimeZone = 'UTC'`)
  })
  afterAll(async () => {
    await db?.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`)
    await db?.end()
  })

  for (const [name, input] of Object.entries(CASES)) {
    it(`aggregate: ${name}`, async () => {
      const spec = Spec.parse(input)
      const built = buildQuery(spec, ctx, 'aggregate')
      const expected = norm(await pgQuery(built.sql, built.params))
      const got = norm(aggregateCustomerRows(rows, spec, ctx).rows)
      expect(got.length).toBe(expected.length)
      // a LIMIT over tied counts picks arbitrary categories in SQL: compare the values only
      if (name === 'dimension limit 3') {
        expect(got.map((g) => g.value).sort()).toEqual(expected.map((e) => e.value).sort())
        return
      }
      got.forEach((g, i) => {
        const e = expected[i]
        expect({ bucket: g.bucket, series: g.series }).toEqual({ bucket: e.bucket, series: e.series })
        expect(close(g.value, e.value), `value ${g.value} vs ${e.value}`).toBe(true)
        expect([g.n_rows, g.n_nonnull]).toEqual([e.n_rows, e.n_nonnull])
      })
    })
  }

  for (const [name, d] of Object.entries(DRILLS)) {
    it(`drill: ${name}`, async () => {
      const spec = Spec.parse(d.spec)
      const built = buildQuery(spec, ctx, 'drill', { ...d.opts, limit: 25 })
      const expected = await pgQuery(built.sql, built.params)
      const got = drillCustomerRows(rows, spec, ctx, { ...d.opts, limit: 25, target: 'drill' }).rows
      expect(got.map((r) => r.id)).toEqual(expected.map((r) => r.id))
      expect(got.map((r) => Number(r.duration_seconds ?? NaN) || null)).toEqual(expected.map((r) => (r.duration_seconds === null ? null : Number(r.duration_seconds) || null)))
      if (expected.length === 25) {
        const last = expected.at(-1)!
        const cursor = { startedAt: new Date(`${String(last.started_at)}Z`).toISOString(), id: String(last.id) }
        const next = buildQuery(spec, ctx, 'drill', { ...d.opts, limit: 25, cursor })
        const page2 = await pgQuery(next.sql, next.params)
        expect(drillCustomerRows(rows, spec, ctx, { ...d.opts, limit: 25, cursor, target: 'drill' }).rows.map((r) => r.id)).toEqual(page2.map((r) => r.id))
      }
    })
  }
})

/**
 * The database function (schema revision 2): api.analytics_run(p_spec, p_ctx) must equal the in-memory evaluator,
 * which the block above ties to Pype's SQL. Skipped while the destination has no such function.
 */
describe.skipIf(!URL)('api.analytics_run = in-memory evaluator', () => {
  let db: Client
  let present = false
  let rows: Record<string, unknown>[]
  beforeAll(async () => {
    db = new Client({ connectionString: URL })
    await db.connect()
    present = !!(await db.query(`SELECT to_regproc('api.analytics_run') AS f`)).rows[0].f
    if (!present) return
    rows = fixture(500)
    await db.query(`DELETE FROM api.pype_voice_call_logs WHERE project_id = $1`, [ctx.projectId])
    for (const r of rows) {
      const cols = Object.keys(r)
      await db.query(`INSERT INTO api.pype_voice_call_logs (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`, cols.map((c) => (r[c] !== null && typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])))
    }
    rows = (await db.query(`SELECT to_jsonb(t) AS j FROM api.pype_voice_call_logs t WHERE project_id = $1`, [ctx.projectId])).rows.map((r) => r.j)
  })
  afterAll(async () => {
    if (present) await db.query(`DELETE FROM api.pype_voice_call_logs WHERE project_id = $1`, [ctx.projectId])
    await db?.end()
  })
  for (const [name, input] of Object.entries(CASES)) {
    it(`aggregate: ${name}`, async (t) => {
      if (!present) return t.skip()
      const spec = Spec.parse(input)
      const res = await db.query(`SELECT api.analytics_run($1::jsonb, $2::jsonb) AS r`, [JSON.stringify(spec), JSON.stringify({ project_id: ctx.projectId, agent_ids: A, tz: ctx.tz, now: ctx.now!.toISOString() })])
      const out = res.rows[0].r
      const got = norm(Array.isArray(out) ? out : out.rows)
      const expected = norm(aggregateCustomerRows(rows, spec, ctx).rows)
      expect(got.length).toBe(expected.length)
      if (name === 'dimension limit 3') return
      got.forEach((g, i) => {
        expect({ bucket: g.bucket, series: g.series }).toEqual({ bucket: expected[i].bucket, series: expected[i].series })
        expect(close(g.value, expected[i].value)).toBe(true)
        expect([g.n_rows, g.n_nonnull]).toEqual([expected[i].n_rows, expected[i].n_nonnull])
      })
    })
  }
})
