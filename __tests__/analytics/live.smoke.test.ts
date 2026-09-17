import { describe, it, expect } from 'vitest'
import { Spec, type SpecInput } from '@/server/analytics/spec'
import { buildQuery } from '@/server/analytics/buildQuery'
import { runQuery } from '@/server/analytics/db'

/**
 * A smoke check against a real database — every query shape the compiler can
 * emit, executed rather than string-matched. The unit tests carry the contract;
 * this catches the things only Postgres can tell you, such as a parameter that
 * is bound down one branch and referenced down another.
 *
 * Skipped unless SUPABASE_POOLER_URL is set, so it never runs in CI by accident:
 *   SUPABASE_POOLER_URL=... npx vitest run __tests__/analytics/live.smoke.test.ts
 */
const AGENT = '781fcc07-6929-4a4a-bc63-bb2b837ce71c'
const ctx = { projectId: 'x', agentIds: [AGENT, '6e5f72dd-1ee5-4dda-9b4b-9ea6f1bec234'],
  deniedFields: new Set<string>(), tz: 'Asia/Kolkata', maxDays: 730 }

const cases: Record<string, SpecInput> = {
  'count by disposition': {
    spec_version: 1, agg: { fn: 'count' },
    dimension: { field: { col: 'transcription_metrics', path: ['final_disposition'] } },
    range: { days: 400 }, exclude_environments: [],
  },
  'calls per day': {
    spec_version: 1, agg: { fn: 'count' }, bucket: 'day', range: { days: 30 }, exclude_environments: [],
  },
  // three encodings, all present in this data: '0'/'1', 'yes'/'no' (mixed case,
  // and mixed with '0' on the same field), and 'true'/'false' beside 'N/A'
  'confirmation rate (1/0)': {
    spec_version: 1,
    agg: { fn: 'rate', field: { col: 'transcription_metrics', path: ['is_confirmation'], boolean_encoding: 'one_zero' } },
    range: { days: 400 }, exclude_environments: [],
  },
  'hindi rate (yes/no, mixed case)': {
    spec_version: 1,
    agg: { fn: 'rate', field: { col: 'transcription_metrics', path: ['is_Conversation_hindi'], boolean_encoding: 'yes_no' } },
    range: { days: 400 }, exclude_environments: [],
  },
  'new patient rate (true/false beside N/A)': {
    spec_version: 1,
    agg: { fn: 'rate', field: { col: 'transcription_metrics', path: ['is_new_patient'], boolean_encoding: 'true_false' } },
    range: { days: 400 }, exclude_environments: [],
  },
  'p95 latency': {
    spec_version: 1, agg: { fn: 'p95', field: { col: 'avg_latency' } }, range: { days: 400 }, exclude_environments: [],
  },
  'one per patient, best outcome': {
    spec_version: 1, grain: 'entity',
    dedupe: { key: { field: { col: 'customer_number' } }, winner: 'best_outcome',
      outcome: { col: 'transcription_metrics', path: ['final_disposition'] },
      ranking: ['appointment_confirmed', 'confirmed', 'transferred', 'user_busy', 'wrong_number'] },
    agg: { fn: 'count' },
    dimension: { field: { col: 'transcription_metrics', path: ['final_disposition'] } },
    range: { days: 400 }, exclude_environments: [],
  },
  'nested object path': {
    spec_version: 1, agg: { fn: 'count' },
    dimension: { field: { col: 'metadata', path: ['usage', 'llm_prompt_tokens'] } },
    range: { days: 400 }, exclude_environments: [],
  },
  'night shift 22:00-02:00': {
    spec_version: 1, agg: { fn: 'count' }, time_of_day: { from: '22:00', to: '02:00' },
    range: { days: 400 }, exclude_environments: [],
  },
}

describe.skipIf(!process.env.SUPABASE_POOLER_URL)('against a real database', () => {
it('runs every query shape the compiler can emit', async () => {
  for (const [name, spec] of Object.entries(cases)) {
    const { sql, params } = buildQuery(Spec.parse(spec), ctx, 'aggregate')
    const t0 = Date.now()
    const rows = await runQuery(sql, params).catch((e) => {
      throw new Error(`${name} failed: ${(e as Error).message}\n${sql}`)
    })
    console.log(`--- ${name}  (${Date.now() - t0}ms, ${rows.length} rows)`)
    console.log(JSON.stringify(rows.slice(0, 5)))
    // every shape reports its coverage, so a number is never unexplained
    expect(rows[0]).toHaveProperty('n_rows')
    expect(rows[0]).toHaveProperty('n_nonnull')
  }
  const drill = buildQuery(Spec.parse(cases['count by disposition']), ctx, 'drill', { dimensionValue: 'user_busy' })
  const rows = await runQuery(drill.sql, drill.params)
  console.log(`--- drill user_busy: ${rows.length} rows`, JSON.stringify(rows.slice(0, 2)))
}, 60_000)
})
